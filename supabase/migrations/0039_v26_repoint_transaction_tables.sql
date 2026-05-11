-- v2.6 §B3 — Repoint sale_items / purchase_items / product_packs at variant_id.
--
-- Append-only triggers on sale_items + purchase_items (financial_records_immutable
-- from v1.8) block UPDATE statements. v1.9 §B and v2.0 §H established the pattern:
-- DISABLE TRIGGER → UPDATE → ENABLE TRIGGER → enforce NOT NULL.
--
-- product_packs has only a touch trigger, no append-only enforcement.
--
-- Audit checkpoints after this migration:
--   sale_items / purchase_items / product_packs all have NOT NULL variant_id
--   and every row's variant_id resolves to the product's default variant.

-- ===========================================================================
-- 1. Add nullable variant_id columns + reference indexes
-- ===========================================================================

alter table public.sale_items
  add column if not exists variant_id uuid references public.product_variants(id);

alter table public.purchase_items
  add column if not exists variant_id uuid references public.product_variants(id);

alter table public.product_packs
  add column if not exists variant_id uuid references public.product_variants(id);

-- ===========================================================================
-- 2. Backfill — every row points at its product's default variant.
--    Append-only triggers must be off for the UPDATE on sale_items /
--    purchase_items. product_packs needs no toggle.
-- ===========================================================================

alter table public.sale_items disable trigger sale_items_no_modify;
update public.sale_items si
   set variant_id = v.id
  from public.product_variants v
 where v.product_id = si.product_id
   and v.is_default
   and si.variant_id is null;
alter table public.sale_items enable trigger sale_items_no_modify;

alter table public.purchase_items disable trigger purchase_items_no_modify;
update public.purchase_items pi
   set variant_id = v.id
  from public.product_variants v
 where v.product_id = pi.product_id
   and v.is_default
   and pi.variant_id is null;
alter table public.purchase_items enable trigger purchase_items_no_modify;

update public.product_packs pp
   set variant_id = v.id
  from public.product_variants v
 where v.product_id = pp.product_id
   and v.is_default
   and pp.variant_id is null;

-- ===========================================================================
-- 3. Audit checkpoints 2-4 (fail-loud at migration time)
-- ===========================================================================

do $$
declare
  v_sale_orphans int;
  v_purchase_orphans int;
  v_pack_orphans int;
begin
  select count(*) into v_sale_orphans     from public.sale_items     where variant_id is null;
  select count(*) into v_purchase_orphans from public.purchase_items where variant_id is null;
  select count(*) into v_pack_orphans     from public.product_packs  where variant_id is null;

  if v_sale_orphans > 0 then
    raise exception 'v26_sale_items_variant_backfill_failed: % rows without variant_id', v_sale_orphans;
  end if;
  if v_purchase_orphans > 0 then
    raise exception 'v26_purchase_items_variant_backfill_failed: % rows without variant_id', v_purchase_orphans;
  end if;
  if v_pack_orphans > 0 then
    raise exception 'v26_product_packs_variant_backfill_failed: % rows without variant_id', v_pack_orphans;
  end if;
end$$;

-- ===========================================================================
-- 4. Enforce NOT NULL + add btree indexes for the new join keys.
-- ===========================================================================

alter table public.sale_items     alter column variant_id set not null;
alter table public.purchase_items alter column variant_id set not null;
alter table public.product_packs  alter column variant_id set not null;

create index if not exists idx_sale_items_variant     on public.sale_items     (variant_id);
create index if not exists idx_purchase_items_variant on public.purchase_items (variant_id);
create index if not exists idx_packs_variant          on public.product_packs  (variant_id) where is_active;
