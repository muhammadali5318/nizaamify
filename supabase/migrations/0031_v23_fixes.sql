-- 0031_v23_fixes.sql
-- v2.3 — Fixes from v2.1/v2.2 testing
-- Companion to MVP_FIXES_v2.3.md
--
-- Idempotent. Two consequential schema changes plus several housekeeping items:
--   §A drop customer_tiers.discount_percent (tiers are categories now)
--   §B rename invoices.tier_* → invoices.sale_discount_* (4 columns)
--      drop the invoices_tier_override_no_tier_id constraint (no longer
--      applicable — tier categorization and discount are independent)
--      rename invoices_tier_override_consistent → invoices_sale_discount_consistent
--   §C add purchase_items.line_overhead_amount + backfill from
--      legacy overhead_per_unit × qty_in_base (overhead_per_unit kept for
--      back-compat — drop in a future cleanup migration)
--   §D ensure pg_trgm + idx_products_name_trgm; drop the v1.5 combined
--      name+type GIN index if present (we're going name-only in v2.3)
--
-- After this migration: regenerate database.ts. Phase C's record_sale
-- and record_purchase rewrites land in 0032 since they need the renamed
-- columns and the new line_overhead_amount column to exist first.

-- ============================================================================
-- §A. customer_tiers — drop discount_percent
-- ============================================================================

alter table public.customer_tiers drop column if exists discount_percent;

-- ============================================================================
-- §B. invoices — rename tier_* → sale_discount_*; rebuild constraints
-- ============================================================================

-- Drop the constraint that linked tier_id and override (no longer applicable)
alter table public.invoices
  drop constraint if exists invoices_tier_override_no_tier_id;

-- Rename columns. Each branch checks if the old name exists first so the
-- migration is safe to re-run if a previous attempt got partway through.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'invoices'
      and column_name = 'tier_override_type'
  ) then
    alter table public.invoices
      rename column tier_override_type to sale_discount_type;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'invoices'
      and column_name = 'tier_override_value'
  ) then
    alter table public.invoices
      rename column tier_override_value to sale_discount_value;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'invoices'
      and column_name = 'tier_discount_percent_snapshot'
  ) then
    alter table public.invoices
      rename column tier_discount_percent_snapshot
                 to sale_discount_percent_snapshot;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'invoices'
      and column_name = 'tier_discount_amount'
  ) then
    alter table public.invoices
      rename column tier_discount_amount to sale_discount_amount;
  end if;
end $$;

-- If v2.2 was never built, create the columns directly with new names.
-- (No-op when the rename above succeeded.)
alter table public.invoices
  add column if not exists sale_discount_type text
    check (sale_discount_type is null or sale_discount_type in ('percent', 'fixed')),
  add column if not exists sale_discount_value numeric(12,2)
    check (sale_discount_value is null or sale_discount_value >= 0),
  add column if not exists sale_discount_percent_snapshot numeric(5,2)
    check (sale_discount_percent_snapshot is null
           or (sale_discount_percent_snapshot >= 0
               and sale_discount_percent_snapshot <= 100)),
  add column if not exists sale_discount_amount numeric(12,2) not null default 0
    check (sale_discount_amount >= 0);

-- Recreate the consistency check under its new name. Drop both the old
-- and new names defensively (the old name is gone post-rename, but if a
-- prior partial run created the new one we want a clean replace).
alter table public.invoices
  drop constraint if exists invoices_tier_override_consistent;
alter table public.invoices
  drop constraint if exists invoices_sale_discount_consistent;
alter table public.invoices
  add constraint invoices_sale_discount_consistent check (
    (sale_discount_type is null and sale_discount_value is null)
    or
    (sale_discount_type is not null and sale_discount_value is not null)
  );

-- ============================================================================
-- §C. purchase_items — line_overhead_amount as new source of truth
-- ============================================================================

alter table public.purchase_items
  add column if not exists line_overhead_amount numeric(12,2) not null default 0
    check (line_overhead_amount >= 0);

-- Backfill from existing overhead_per_unit × qty_in_base. Legacy rows may
-- have minor rounding drift (the bug v2.3 fixes); new rows from the
-- rewritten record_purchase will be exact via largest-remainder.
-- Append-only trigger blocks UPDATE on purchase_items, so disable for the
-- backfill and re-enable immediately after (same pattern as v1.9 §B and
-- v2.0 §C — see CLAUDE.md gotcha).
alter table public.purchase_items disable trigger purchase_items_no_modify;
update public.purchase_items
   set line_overhead_amount = round(coalesce(overhead_per_unit, 0) * qty_in_base, 2)
 where line_overhead_amount = 0
   and coalesce(overhead_per_unit, 0) > 0;
alter table public.purchase_items enable trigger purchase_items_no_modify;

-- ============================================================================
-- §D. Search index hygiene (name-only)
-- ============================================================================

create extension if not exists pg_trgm with schema extensions;

-- Ensure the name-only GIN index exists (v1.5). idempotent.
create index if not exists idx_products_name_trgm
  on public.products using gin (name gin_trgm_ops);

-- If a combined (name || type) index from an earlier iteration ever landed,
-- drop it — v2.3 search is name-only and the combined index is dead weight.
drop index if exists public.idx_products_name_type_trgm;
