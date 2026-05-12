# MVP v2.6 — Foundational Variant Refactor (Silent)

**Audience:** Claude Code
**Companion to:** `PRD.md` and v1.3–v2.5 specs.
**Stack:** unchanged.
**Type:** **Foundational refactor — zero user-visible changes.**
**Realistic effort:** 2 weeks.
**Followed by:** v2.7 (variant management UI, user-visible features).

> **This ticket ships nothing visible.** Every product becomes a template; every product gets a synthetic "default" variant carrying its old stock/price/cost. All transaction tables (sale_items, purchase_items, product_packs) re-point to `variant_id` instead of `product_id`. All RPCs are rewritten to operate through variants. The UI is updated to read through views that hide the variant layer for single-variant products. After this ticket lands, **users see the exact same UI they did before** — but the data model is ready for v2.7's variant features.
>
> This is invisible value. It's also the only honest way to add variant support without producing a system riddled with "is this a variant product?" branches for years.

---

## 0. How to work this ticket

### Phase A — Discovery (mandatory before code)

1. **Read `CLAUDE.md`** and recent fix specs (`v2.1`, `v2.2`, `v2.3`, `v2.5`). Update `CLAUDE.md` at the end of this ticket.
2. **Skills check** — use `frontend-design` skill at `/mnt/skills/public/frontend-design/SKILL.md`. Use any migration-related skill if present in `/mnt/skills/`.
3. **Inspect live schema via MCP.** Confirm:
   - Current `products` columns (especially stock, price, cost, avg_cost, last_purchase_cost, base_unit_id, is_scan_only, category_id).
   - Current `sale_items` columns (after v2.3 — qty, price_at_sale, cost_at_sale, line_discount_*).
   - Current `purchase_items` columns (after v2.3 — pack_id, pack_qty, pack_base_qty_snapshot, qty_in_base, cost_at_purchase, overhead_per_unit, line_overhead_amount, avg_cost_before, avg_cost_after).
   - Current `product_packs` columns (after v2.1 — product_id, unit_id, base_qty, is_default_purchase, is_active).
   - Current `invoices` columns (after v2.5 — confirm v2.3 renames are in place).
   - Whether v2.5's `product_categories` table and `products.category_id` FK are present.
4. **Sample current data volume per shop:**
   ```sql
   select shop_id,
          count(*) as products,
          count(*) filter (where stock > 0) as products_with_stock,
          (select count(*) from public.sale_items si join public.invoices i on i.id = si.invoice_id where i.shop_id = p.shop_id) as sale_item_rows,
          (select count(*) from public.purchase_items pi join public.purchases pu on pu.id = pi.purchase_id where pu.shop_id = p.shop_id) as purchase_item_rows
   from public.products p
   group by shop_id;
   ```
   Output sizes the migration. Single test shop with < 1000 transactions → instant. Multi-shop with 100k+ transactions → migration needs careful indexing.
5. **Generate `tasks.md`** at project root before any code (see §15).
6. **Generate `decisions/` folder entries** for the architectural choices being made here (see §16).
7. **Discovery report in chat** — schema state, data volume, plan, then proceed.

### Phase B — Schema migration

Single migration `00XX_v26_variant_refactor.sql`. The most complex migration in the project's history. Apply via MCP. Verify each step's audit query passes before proceeding to the next step. Regenerate `database.ts` at the end.

### Phase C — Backend functions

Rewrite every function that reads or writes stock, price, or cost. `record_sale`, `record_purchase`, `create_product_with_opening_stock`, `search_products`, related views and RPCs. All point at `variant_id` instead of `product_id` internally; some keep `product_id`-shaped contracts at the API boundary for backward compat during the rollout.

### Phase D — Frontend

The frontend changes are surgical — read through views/RPCs that abstract away the variant layer for single-variant products. No new UI surfaces in this ticket. The product form, list, POS, sale detail, stock-in form, purchase detail — all keep their existing shape.

### Phase E — Verification

Manual smoke test of every flow that touches stock/price/cost. All v1.3–v2.5 acceptance criteria must still pass. Update CLAUDE.md.

---

## 1. The architectural decision (recorded in `decisions/`)

This entire ticket exists because of a single architectural choice that will outlive every other decision in the system. Worth restating explicitly:

**Decision: every product is a template. Every product has at least one variant. Stock, price, cost, and inventory state live on `product_variants`, not `products`. The `products` table is pure metadata: name, category, description, type (stockable/service/consumable).**

Alternatives considered:
- **Variants as optional layer on top of products** (the "bolt-on" approach). Products keep their stock/price; some products get extra variant rows. Rejected because every query in the system would have to ask "is this a variant product or not?" creating a forked codebase forever.
- **Multiple SKUs as separate products** (the "split" approach). Each color × size is its own product. Rejected because reports become impossible ("total Tracksuit AAA sales") and the data model doesn't reflect the shop owner's mental model.

Consequence of the decision: every existing product gets a synthetic **default variant** during migration. Single-variant products are products with exactly one variant marked `is_default = true`. The UI hides the variant layer for these products — the user sees no difference from before. Multi-variant products (introduced in v2.7) have multiple variants, with `is_default = false` on all of them.

This decision file lives at `decisions/2026-05-12-product-template-variant-architecture.md`. See §16 for the template.

---

## 2. Schema changes

Single migration `00XX_v26_variant_refactor.sql`. Phases inside the migration; each audit-query checkpoint runs before the next phase.

### 2.1 Create `product_variants` table

```sql
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text,                                    -- optional, free-text; v2.7 auto-suggests
  stock integer not null default 0 check (stock >= 0),
  price numeric(12,2) check (price is null or price >= 0),
    -- Per v2.1 pricing rule: null = not sellable at this variant
  cost numeric(12,2) check (cost is null or cost >= 0),
    -- legacy products.cost moved here; will deprecate when products.cost drops
  avg_cost numeric(12,2) not null default 0 check (avg_cost >= 0),
  last_purchase_cost numeric(12,2),
  is_default boolean not null default false,
    -- True for synthetic default variant on single-variant products.
    -- False once v2.7 adds real variants.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every product must have exactly one default variant (partial unique index)
create unique index if not exists uq_variant_default_per_product
  on public.product_variants (product_id) where is_default and is_active;

-- SKU uniqueness within a shop (if set)
create unique index if not exists uq_variant_sku_per_shop
  on public.product_variants (
    (select shop_id from public.products where id = product_variants.product_id),
    lower(trim(sku))
  ) where sku is not null and is_active;

create index if not exists idx_variant_product on public.product_variants (product_id) where is_active;
create index if not exists idx_variant_stock on public.product_variants (product_id, stock) where is_active;

alter table public.product_variants enable row level security;

create policy "variants_shop_read" on public.product_variants
  for select using (
    exists (select 1 from public.products p
            where p.id = product_id and p.shop_id = (select public.current_shop_id()))
  );
create policy "variants_shop_write" on public.product_variants
  for all using (
    exists (select 1 from public.products p
            where p.id = product_id and p.shop_id = (select public.current_shop_id()))
  ) with check (
    exists (select 1 from public.products p
            where p.id = product_id and p.shop_id = (select public.current_shop_id()))
  );

drop trigger if exists product_variants_touch on public.product_variants;
create trigger product_variants_touch
  before update on public.product_variants
  for each row execute function public.touch_updated_at();
```

### 2.2 Backfill — every product gets one default variant

```sql
-- Insert one default variant per active product, carrying the old values
insert into public.product_variants (
  product_id, sku, stock, price, cost, avg_cost, last_purchase_cost,
  is_default, is_active
)
select
  p.id,
  null,                          -- no SKU initially
  p.stock,
  p.price,
  p.cost,                        -- legacy column still on products
  coalesce(p.avg_cost, 0),
  p.last_purchase_cost,
  true,                          -- mark as the default
  p.is_active
from public.products p
where not exists (
  select 1 from public.product_variants v
  where v.product_id = p.id and v.is_default
);
```

**Audit checkpoint 1.** Every active product must have exactly one default variant:
```sql
-- Must return zero rows
select p.id, p.name, count(v.id) as default_variants
from public.products p
left join public.product_variants v on v.product_id = p.id and v.is_default and v.is_active
where p.is_active
group by p.id, p.name
having count(v.id) <> 1;
```

If non-zero rows: investigate, fix, re-run. Do not proceed.

### 2.3 Add `variant_id` to transaction tables

```sql
-- sale_items
alter table public.sale_items
  add column if not exists variant_id uuid references public.product_variants(id);

-- purchase_items
alter table public.purchase_items
  add column if not exists variant_id uuid references public.product_variants(id);

-- product_packs (packs become per-variant in v2.6)
alter table public.product_packs
  add column if not exists variant_id uuid references public.product_variants(id);
```

### 2.4 Backfill `variant_id` from `product_id`

```sql
-- sale_items: point each row at the product's default variant
update public.sale_items si
set variant_id = v.id
from public.product_variants v
where v.product_id = si.product_id
  and v.is_default
  and si.variant_id is null;

-- purchase_items: same
update public.purchase_items pi
set variant_id = v.id
from public.product_variants v
where v.product_id = pi.product_id
  and v.is_default
  and pi.variant_id is null;

-- product_packs: same
update public.product_packs pp
set variant_id = v.id
from public.product_variants v
where v.product_id = pp.product_id
  and v.is_default
  and pp.variant_id is null;
```

**Audit checkpoint 2.** Every transaction row must have a variant_id:
```sql
-- All three must return zero rows
select count(*) as orphans from public.sale_items where variant_id is null;
select count(*) as orphans from public.purchase_items where variant_id is null;
select count(*) as orphans from public.product_packs where variant_id is null;
```

### 2.5 Enforce variant_id NOT NULL

```sql
alter table public.sale_items alter column variant_id set not null;
alter table public.purchase_items alter column variant_id set not null;
alter table public.product_packs alter column variant_id set not null;
```

### 2.6 Indexes on variant_id

```sql
create index if not exists idx_sale_items_variant on public.sale_items (variant_id);
create index if not exists idx_purchase_items_variant on public.purchase_items (variant_id);
create index if not exists idx_packs_variant on public.product_packs (variant_id) where is_active;
```

### 2.7 Update unique constraints

The v2.1 unique constraint `uq_pack_product_unit` on `product_packs (product_id, unit_id)` becomes `(variant_id, unit_id)`:

```sql
drop index if exists uq_pack_product_unit;
create unique index if not exists uq_pack_variant_unit
  on public.product_packs (variant_id, unit_id) where is_active;

-- Default-purchase-per-product becomes per-variant
drop index if exists uq_pack_default_purchase;
create unique index if not exists uq_pack_default_purchase
  on public.product_packs (variant_id) where is_default_purchase and is_active;
```

### 2.8 Deprecate (don't drop) `product_id` columns on transaction tables

`product_id` columns stay for one cycle for backward compat. They are kept in sync via triggers, then dropped in a future cleanup migration.

Add a deferred-drop note to CLAUDE.md. Don't drop `sale_items.product_id`, `purchase_items.product_id`, `product_packs.product_id` in this migration.

> **Why keep the redundant columns?** A subset of legacy queries (reports, analytics views, possibly external dashboards) may still reference `product_id`. The redundant FK keeps them working. A trigger ensures `product_id = (select product_id from product_variants where id = variant_id)` whenever variant_id is updated. Acceptable data duplication during a known transitional window.

```sql
-- Trigger to keep product_id in sync with variant_id on insert/update
create or replace function public.sync_product_id_from_variant() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.product_id := (select product_id from public.product_variants where id = new.variant_id);
  return new;
end;
$$;

drop trigger if exists sale_items_sync_product_id on public.sale_items;
create trigger sale_items_sync_product_id
  before insert or update on public.sale_items
  for each row execute function public.sync_product_id_from_variant();

drop trigger if exists purchase_items_sync_product_id on public.purchase_items;
create trigger purchase_items_sync_product_id
  before insert or update on public.purchase_items
  for each row execute function public.sync_product_id_from_variant();

drop trigger if exists product_packs_sync_product_id on public.product_packs;
create trigger product_packs_sync_product_id
  before insert or update on public.product_packs
  for each row execute function public.sync_product_id_from_variant();
```

### 2.9 Deprecate (don't drop) `products` stock/price/cost columns

`products.stock`, `products.price`, `products.cost`, `products.avg_cost`, `products.last_purchase_cost` stay for one cycle as deprecated columns. They are NOT kept in sync — variant is the source of truth from now on. Reads through the compat view (§3.1) abstract this away.

Listed in CLAUDE.md as deprecated. Drop in a v2.7 or v2.8 cleanup migration.

### 2.10 Compat view: `product_with_default_variant`

A view that joins products to their default variant, exposing the old products-shape:

```sql
create or replace view public.product_with_default_variant as
select
  p.id as product_id,
  p.shop_id,
  p.name,
  p.category_id,
  p.description,
  p.type as legacy_type_column,    -- the deprecated text column from pre-v2.5
  p.is_scan_only,
  p.is_active as product_is_active,
  p.base_unit_id,
  p.created_at as product_created_at,
  p.updated_at as product_updated_at,
  -- variant fields hoisted to top level for old-shape consumers
  v.id as variant_id,
  v.sku,
  v.stock,
  v.price,
  v.cost,
  v.avg_cost,
  v.last_purchase_cost,
  v.is_active as variant_is_active
from public.products p
left join public.product_variants v on v.product_id = p.id and v.is_default and v.is_active;
```

This view is what the products list, search, POS picker, and stock-in form will read from. As long as products have one default variant, this view returns one row per product — the UI sees the old shape.

In v2.7 when products gain multiple variants, the UI starts reading directly from `product_variants` for those products. But until then, this view is the bridge.

---

## 3. Function rewrites

Every RPC that reads or writes stock, price, cost, or product_id-on-transaction now operates through variants.

### 3.1 `record_sale` rewrite

Read v2.3's version via MCP. Modify the items shape: accept `variant_id` (preferred) OR `product_id` (legacy, resolved to default variant). New ones from v2.7 will always pass `variant_id`; existing UI passes `product_id` until updated.

Key changes:
- `p_items[].product_id` becomes `p_items[].variant_id` (preferred). Backward compat: if `variant_id` is missing but `product_id` is present, resolve to the default variant.
- Lock the variant row with `FOR UPDATE` (not the product row).
- Stock check, decrement, avg_cost read — all from variant.
- INSERT into `sale_items` with `variant_id` (`product_id` populated by the trigger from §2.8).

```sql
-- inside the per-item loop, replacing v2.3's product-resolution block

declare
  v_variant record;
  v_resolved_variant_id uuid;
begin
  if v_item ? 'variant_id' and v_item->>'variant_id' is not null then
    v_resolved_variant_id := (v_item->>'variant_id')::uuid;
  elsif v_item ? 'product_id' and v_item->>'product_id' is not null then
    select id into v_resolved_variant_id
    from public.product_variants
    where product_id = (v_item->>'product_id')::uuid
      and is_default and is_active;
    if v_resolved_variant_id is null then
      raise exception 'product_has_no_default_variant';
    end if;
  else
    raise exception 'item_missing_variant_or_product_id';
  end if;

  -- Lock the variant (and verify shop ownership through the product join)
  select v.id, v.stock, v.avg_cost, v.price, p.shop_id, p.id as product_id
  into v_variant
  from public.product_variants v
  join public.products p on p.id = v.product_id
  where v.id = v_resolved_variant_id
  for update;

  if not found then raise exception 'variant_not_found'; end if;
  if v_variant.shop_id <> v_shop_id then raise exception 'variant_not_in_shop'; end if;
  if v_variant.price is null then raise exception 'variant_not_sellable'; end if;

  -- Stock check, line discount, etc. — same logic as v2.3 from here on
  if v_variant.stock < v_qty then
    raise exception 'insufficient_stock for variant %', v_variant.id;
  end if;

  -- INSERT sale_items with variant_id (trigger syncs product_id)
  insert into public.sale_items (
    invoice_id, variant_id, qty, price_at_sale, cost_at_sale,
    line_discount_type, line_discount_value, line_discount_amount
  ) values (
    v_invoice_id, v_variant.id, v_qty,
    (v_item->>'price_at_sale')::numeric, v_variant.avg_cost,
    v_line_discount_type, v_line_discount_value, v_line_discount_amount
  );

  -- Decrement variant stock
  update public.product_variants
  set stock = stock - v_qty, updated_at = now()
  where id = v_variant.id;
end;
```

> **The single most important line in this entire spec:** stock decrements on `product_variants.stock`. Never on `products.stock` (which is deprecated). Every test must verify this.

### 3.2 `record_purchase` rewrite

Same surgery. Read v2.3's version. Replace `product_id` resolution with `variant_id` resolution. Lock and update the variant. v2.3's largest-remainder overhead allocation is unchanged in its math; just operates on variants now.

Backward compat shape: line items accept `variant_id` (preferred) or `product_id` (resolved to default variant).

### 3.3 `create_product_with_opening_stock` rewrite

Per v1.5/v2.5, this creates a product with optional opening stock. In v2.6, it creates a product **AND its default variant** in one transaction.

```sql
create or replace function public.create_product_with_opening_stock(
  p_name text,
  p_category_id uuid,
  p_price numeric(12,2),
  p_opening_stock int default 0,
  p_opening_cost numeric(12,2) default null,
  p_is_scan_only boolean default false,
  p_base_unit_code text default 'each'
) returns table (product_id uuid, variant_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_product_id uuid;
  v_variant_id uuid;
  v_base_unit_id uuid;
begin
  -- guards, base_unit resolution per v2.1 ...

  insert into public.products (
    shop_id, name, category_id, is_scan_only, base_unit_id
  ) values (
    v_shop_id, trim(p_name), p_category_id, p_is_scan_only, v_base_unit_id
  ) returning id into v_product_id;

  insert into public.product_variants (
    product_id, stock, price, cost, avg_cost, is_default, is_active
  ) values (
    v_product_id,
    coalesce(p_opening_stock, 0),
    p_price,
    p_opening_cost,
    coalesce(p_opening_cost, 0),
    true,                          -- this is the default variant
    true
  ) returning id into v_variant_id;

  -- If there's opening stock, record_purchase the synthetic opening purchase
  -- (per v1.5, opening stock is recorded as is_opening = true via record_purchase)
  if p_opening_stock > 0 and p_opening_cost is not null then
    perform public.record_purchase(
      null::uuid,                  -- no supplier for opening stock
      current_date,
      'Opening stock',
      jsonb_build_array(jsonb_build_object(
        'variant_id', v_variant_id,
        'qty', p_opening_stock,
        'cost_at_purchase', p_opening_cost
      )),
      '[]'::jsonb,
      true                          -- is_opening
    );
  end if;

  return query select v_product_id, v_variant_id;
end;
$$;
```

### 3.4 `search_products` rewrite

The function returns rows from `product_with_default_variant` (the compat view). The UI keeps the old shape for now.

```sql
create or replace function public.search_products(
  p_query text default null,
  p_category_id uuid default null,
  p_limit int default 50,
  p_offset int default 0
) returns setof public.product_with_default_variant
language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_q text := coalesce(trim(p_query), '');
begin
  if v_shop_id is null then return; end if;
  set local pg_trgm.similarity_threshold = 0.2;

  if length(v_q) = 0 then
    return query
      select * from public.product_with_default_variant
      where shop_id = v_shop_id
        and product_is_active
        and (p_category_id is null or category_id = p_category_id)
      order by product_updated_at desc
      limit p_limit offset p_offset;
    return;
  end if;

  return query
    select * from public.product_with_default_variant
    where shop_id = v_shop_id
      and product_is_active
      and (p_category_id is null or category_id = p_category_id)
      and (name % v_q OR name ilike '%' || v_q || '%')
    order by
      case when name ilike v_q || '%' then 0 else 1 end,
      similarity(name, v_q) desc nulls last,
      length(name)
    limit p_limit offset p_offset;
end;
$$;
```

### 3.5 Stock display view update

v2.1's `product_stock_display` view points at `product_packs.product_id` and `products.stock`. Update to read from variants:

```sql
create or replace view public.product_stock_display as
select
  v.id as variant_id,
  p.id as product_id,
  p.shop_id,
  v.stock as base_qty,
  bu.code as base_unit_code,
  bu.name as base_unit_name,
  p.is_scan_only,
  (
    select coalesce(jsonb_agg(jsonb_build_object(
      'pack_id', pk.id,
      'unit_code', u.code,
      'unit_name', u.name,
      'base_qty', pk.base_qty,
      'whole_packs', floor(v.stock::numeric / pk.base_qty)::int,
      'remainder_base', (v.stock - floor(v.stock::numeric / pk.base_qty)::int * pk.base_qty)::int
    ) order by pk.base_qty desc), '[]'::jsonb)
    from public.product_packs pk
    join public.units_of_measure u on u.id = pk.unit_id
    where pk.variant_id = v.id and pk.is_active
  ) as pack_breakdown
from public.product_variants v
join public.products p on p.id = v.product_id
join public.units_of_measure bu on bu.id = p.base_unit_id
where v.is_active;
```

Now keyed on variant_id. Single-variant products: one row each. v2.7's multi-variant products: one row per variant.

### 3.6 Pack management RPCs

v2.1's `define_pack_inline`, `update_pack`, `deactivate_pack` operate on `product_id` today. Update to operate on `variant_id`. For single-variant products, the UI keeps passing product_id; the function resolves to the default variant internally:

```sql
-- inside define_pack_inline, before the existing logic:
declare v_variant_id uuid;
begin
  -- If caller passes variant_id directly (v2.7+), use it
  if p_variant_id is not null then
    v_variant_id := p_variant_id;
  else
    -- Resolve to default variant from product_id (v2.6 compat)
    select id into v_variant_id
    from public.product_variants
    where product_id = p_product_id and is_default and is_active;
    if v_variant_id is null then raise exception 'product_has_no_default_variant'; end if;
  end if;
  -- ... rest of v2.1 logic using v_variant_id
end;
```

---

## 4. Append-only enforcement

`sale_items` and `purchase_items` are append-only per v1.6/v1.8. Verify triggers still apply after column additions. The new `variant_id` column is part of the immutable record (along with the legacy `product_id` which the trigger keeps in sync).

---

## 5. Frontend changes (minimal — read through the compat view)

This is what "silent" means in practice. The frontend reads continue to work because they go through `search_products` (which returns the compat-view shape) and the views that abstract variants away.

### 5.1 What changes in the frontend

- TypeScript types regenerated against the new schema. `Product` type now has both `product_id` and `variant_id` available. Most components keep using `product_id` for keying.
- Components that submit data to `record_sale` and `record_purchase` may need to be updated to pass `variant_id` (or just leave `product_id` and the function resolves it). Recommend updating to `variant_id` opportunistically when each component is touched, so v2.7 onboarding is smoother.
- The product detail page from v2.5 (`/products/:id`) starts reading variant-level fields for display (stock, price, avg_cost from the default variant), but the UI shape stays the same.

### 5.2 What stays the same

- Product list, POS picker, stock-in form, sale detail, purchase detail, customer khata — all unchanged visually.
- Search behavior unchanged.
- Per-line discounts (v2.3) and sale-level discount (v2.3) unchanged.
- Pack creation at stock-in (v2.1) unchanged.

### 5.3 Critical: no new variant UI in this ticket

If you find yourself reaching for a "variants" UI element, stop. That's v2.7. v2.6 ships the foundation; v2.7 ships the user-visible features. Mixing them is the failure mode.

---

## 6. Audit queries (run after migration, document results in chat)

After the migration applies, run all six queries. Each must return zero rows:

```sql
-- 1. Every active product has exactly one default variant
select p.id, count(v.id) as default_variants
from public.products p
left join public.product_variants v on v.product_id = p.id and v.is_default and v.is_active
where p.is_active
group by p.id
having count(v.id) <> 1;

-- 2. No sale_items missing variant_id
select count(*) from public.sale_items where variant_id is null;

-- 3. No purchase_items missing variant_id
select count(*) from public.purchase_items where variant_id is null;

-- 4. No product_packs missing variant_id
select count(*) from public.product_packs where variant_id is null;

-- 5. variant_id and product_id consistency on sale_items
select si.id from public.sale_items si
join public.product_variants v on v.id = si.variant_id
where si.product_id <> v.product_id;

-- 6. variant_id and product_id consistency on purchase_items
select pi.id from public.purchase_items pi
join public.product_variants v on v.id = pi.variant_id
where pi.product_id <> v.product_id;
```

If any query returns rows: investigate, document in `decisions/`, fix, re-run. Do not declare the ticket done with audit failures.

---

## 7. Reconciliation checks (run after the function rewrites)

Beyond schema audits, verify the math still produces the same numbers:

```sql
-- Sum of variant stock per product = old products.stock (within rounding)
select p.id, p.name, p.stock as old_stock, sum(v.stock) as variant_stock_sum
from public.products p
join public.product_variants v on v.product_id = p.id and v.is_active
where p.is_active
group by p.id, p.name, p.stock
having p.stock <> sum(v.stock);
-- (In v2.6 every product has exactly one variant so these are always equal.
--  In v2.7 with multi-variant products this query won't compare and is dropped.)

-- Sum of variant avg_cost-weighted stock should match old products.avg_cost × stock
-- (Same reasoning as above; v2.6 is one-to-one.)
```

---

## 8. Implementation order

1. **Discovery report in chat** (Phase A).
2. **Generate `tasks.md`** with the order below.
3. **Migration applied** in `00XX_v26_variant_refactor.sql` (§2). Run audit checkpoints between phases.
4. **Regenerate `database.ts`.**
5. **Backend RPCs rewritten:**
   - `record_sale` (§3.1)
   - `record_purchase` (§3.2)
   - `create_product_with_opening_stock` (§3.3)
   - `search_products` (§3.4)
   - Pack management RPCs (§3.6)
6. **Views updated:** `product_with_default_variant` (§2.10), `product_stock_display` (§3.5).
7. **Run all six audit queries** from §6.
8. **Frontend:** TypeScript types regenerated. Verify no component breaks. Update components to pass `variant_id` opportunistically (not exhaustively).
9. **Manual smoke test** (§12).
10. **Record decisions** in `decisions/` (§16).
11. **Update `CLAUDE.md`** (§17).
12. **Final report in chat** with: audit query results, smoke test summary, list of v2.5/v2.3/v2.1/v1.x flows verified to still work.

---

## 9. Hard constraints

- **ZERO user-visible changes.** Every screen must look and behave exactly as it did before v2.6.
- **ZERO new acceptance criteria that aren't already in v1.3–v2.5.** Every existing criterion must still pass.
- **NO variant management UI in this ticket.** That's v2.7.
- **NO dropping of deprecated columns** (`products.stock`, `products.price`, etc., or `*.product_id` on transaction tables). Drop in a future cleanup migration after v2.7 stabilizes.

---

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Migration runs out of memory on large purchase_items / sale_items backfill | Batch the backfill in chunks of 50k rows. PL/pgSQL loop with `select for update skip locked` if needed. |
| Frontend component breaks because it reads a removed field | Discovery: search the codebase for direct reads of `products.stock`, `products.price`, `products.cost`. Update those reads to go through the compat view. |
| Trigger that syncs `product_id` from `variant_id` causes performance regression on bulk inserts | Add a benchmark step: before/after timings for `record_sale` and `record_purchase` on a 100-line transaction. Acceptable: < 10% slowdown. If worse, batch sync instead of per-row trigger. |
| Existing reports reference `products.stock` and break silently | List all views and reports queried in the codebase. Audit each one. Update to use the compat view or variant-level data. |
| Concurrent edits to the same product during migration | Apply migration during a quiet window. Standard Supabase migration discipline. |

---

## 11. Acceptance criteria

- [ ] `tasks.md` and `decisions/` folder created and maintained.
- [ ] CLAUDE.md updated with v2.6 line and gotchas (§17).
- [ ] Phase A discovery report posted: schema state, data volume per shop, plan.
- [ ] `product_variants` table created with RLS, indexes, default-per-product partial unique index.
- [ ] Every active product has exactly one active default variant (audit query 1 returns zero rows).
- [ ] `sale_items.variant_id`, `purchase_items.variant_id`, `product_packs.variant_id` columns exist, populated, NOT NULL.
- [ ] Audit queries 2-6 all return zero rows.
- [ ] Sync trigger keeps `product_id` accurate on insert/update.
- [ ] `product_with_default_variant` view exists and returns one row per active product.
- [ ] `product_stock_display` view updated to read from variants.
- [ ] `record_sale` accepts both `variant_id` and `product_id` (legacy) shapes; decrements variant stock.
- [ ] `record_purchase` accepts both shapes; updates variant stock and avg_cost.
- [ ] `create_product_with_opening_stock` creates product + default variant in one transaction.
- [ ] `search_products` returns compat-view rows; UI unchanged.
- [ ] Pack management RPCs resolve to default variant when only `product_id` is passed.
- [ ] **All v1.3–v2.5 manual test matrices pass.** Specifically:
  - v1.4 partial payments, customer khata
  - v1.5 product creation, fuzzy search
  - v1.6 ledger and reversals
  - v1.9 stock-in with overhead allocation
  - v2.1 pack-based stock-in (single-variant)
  - v2.3 line discounts, sale-level discount, search by name
  - v2.5 product detail page, category filter, eye icon
- [ ] No new console errors.
- [ ] Performance benchmarks: `record_sale` and `record_purchase` within 10% of pre-v2.6 timings.
- [ ] RLS isolates variants per shop (cross-shop test: account B can't see A's variants).

---

## 12. Manual test matrix

### 12.1 Stock-in (single-variant product, default variant only)
- Existing product with stock 50.
- Stock-in 10 more at cost 100. Verify: variant stock 60. Variant avg_cost recalculated.
- Product list still shows the product with stock 60 (read through compat view).
- Same UI as before. No new fields. No visual change.

### 12.2 Sale (single-variant)
- POS: add product, qty 3 at price 150. Cash payment. Submit.
- Sale detail: same UI. Stock decrement: 60 → 57.
- Verify `sale_items.variant_id` populated; `product_id` populated by trigger.

### 12.3 Partial payment + line discount + sale-level discount (v2.3 regression)
- Repeat v2.3 §11.3, §11.6, §11.7 tests.
- All numbers identical to v2.3 expected values.

### 12.4 Stock-in with packs (v2.1 regression)
- Repeat v2.1 §9.3 (mobile shop) and §9.4 (chocolate cash-and-carry).
- All math identical.

### 12.5 Stock-in with overhead (v1.9 + v2.3 rounding regression)
- Repeat v2.3 §11.1 (Redmi + iPhone, 1000 PKR delivery).
- Per-unit overhead values identical: 14.88 and 11.91.

### 12.6 Product detail page (v2.5 regression)
- Open `/products/:id`. Verify same fields display.
- Edit price. Save. Detail page reflects new price.
- POS drawer: open, edit, close. Cart state preserved.

### 12.7 Category filter (v2.5 regression)
- Filter by category. Same results.

### 12.8 Cross-shop isolation
- Account B cannot see A's variants.

### 12.9 Performance check
- Time `record_sale` for a 10-line cart. Compare to pre-v2.6 baseline. Acceptable: within 10%.
- Time `search_products` with 500 products. Compare. Same threshold.

### 12.10 Append-only enforcement
- Try to UPDATE `sale_items.variant_id` directly via SQL. Verify rejected by append-only trigger.

---

## 13. Out of scope

- **Variant management UI.** v2.7.
- **Multiple-variant products.** v2.7.
- **Variant attributes** (Color, Size, Storage). v2.7.
- **Variant matrix at stock-in.** v2.7.
- **Variant-level reporting.** v2.7 / future.
- **Dropping deprecated columns** (`products.stock`, `*.product_id`). Future cleanup migration after v2.7 stabilizes.
- **Bulk variant import** (CSV / Excel). v2.8 if needed.
- **Test infrastructure.** Still skipped.

---

## 14. Decision files to create in `decisions/`

For this ticket, the following decision files must exist in `decisions/` after work completes. See §16 for the template structure.

1. `2026-05-12-product-template-variant-architecture.md` — the foundational call (Approach B over Approach A; every product is a template).
2. `2026-05-12-default-variant-pattern-for-single-variant-products.md` — synthetic default variant carrying old values; UI hides the variant layer for these.
3. `2026-05-12-deprecate-without-drop-product-id-columns.md` — why `*.product_id` columns stay during the transition; trigger-based sync.
4. `2026-05-12-shop-wide-variant-attributes-model.md` — Color, Size, etc. live at shop level, reusable across products. (Documents the v2.7 plan as a decision recorded in v2.6 because it affects schema choices made now.)
5. `2026-05-12-variant-id-or-product-id-rpc-contract.md` — `record_sale` and `record_purchase` accept both shapes during the transition; new code uses `variant_id`; legacy code keeps working.

If implementation surfaces other meaningful judgment calls, write more decision files.

---

## 15. `tasks.md` structure

```markdown
# v2.6 Implementation Tasks

## Status legend
🟦 not started · 🟨 in progress · ✅ done · ❌ blocked

## Phase A — Discovery
- 🟦 Read CLAUDE.md and v2.1, v2.3, v2.5
- 🟦 Inspect schema; document current state
- 🟦 Sample data volume per shop
- 🟦 Generate tasks.md and decisions/ scaffolding
- 🟦 Post discovery report

## Phase B — Schema migration
- 🟦 Create product_variants table
- 🟦 Insert default variant per product (audit 1)
- 🟦 Add variant_id to sale_items, purchase_items, product_packs
- 🟦 Backfill variant_id (audit 2-4)
- 🟦 Set variant_id NOT NULL on all three
- 🟦 Add indexes on variant_id
- 🟦 Migrate unique constraints to variant_id (product_packs)
- 🟦 Add sync trigger for product_id ← variant_id
- 🟦 Create product_with_default_variant view
- 🟦 Update product_stock_display view
- 🟦 Regenerate database.ts

## Phase C — Function rewrites
- 🟦 record_sale (variant-aware, backward compat)
- 🟦 record_purchase (variant-aware, backward compat)
- 🟦 create_product_with_opening_stock (creates default variant)
- 🟦 search_products (returns compat view rows)
- 🟦 Pack management RPCs (resolve to default variant)

## Phase D — Frontend
- 🟦 Regenerate TS types
- 🟦 Verify no compilation errors
- 🟦 Spot-update components to pass variant_id (opportunistic)

## Phase E — Verification
- 🟦 Run audit queries §6
- 🟦 Run reconciliation queries §7
- 🟦 Manual smoke test §12
- 🟦 Performance benchmark
- 🟦 Update CLAUDE.md
- 🟦 Write decision files (§14)
- 🟦 Final report in chat
```

---

## 16. `decisions/` file template

For each decision file in §14, use:

```markdown
# Decision: <title>

**Date:** 2026-05-12
**Ticket:** v2.6
**Status:** Accepted

## Context
What problem we were solving. State of the system before. What the user / business pressure was.

## Decision
What we decided. Concrete: schema shape, function contract, UI rule.

## Alternatives considered
What else was on the table. Why each was rejected.

## Consequences
What this enables (positive). What it locks in (neutral). What migration debt it creates (negative).

## References
Related v2.x specs, MCP queries, code paths.
```

---

## 17. CLAUDE.md update

Append to versioned PRDs section:

```
- v2.6: foundational variant refactor (SILENT — zero user-visible changes). products become templates; stock/price/cost moved to product_variants; every product gets synthetic default variant; all RPCs rewritten to operate on variants with backward-compat product_id resolution. Sets up v2.7 variant management UI.
```

Add to **Open ToDos / Known gaps**:

```
- Deprecated columns NOT YET DROPPED: products.stock, products.price, products.cost, products.avg_cost, products.last_purchase_cost (now on product_variants); sale_items.product_id, purchase_items.product_id, product_packs.product_id (kept via sync trigger). Drop in v2.8 cleanup migration after v2.7 stabilizes.
```

Add to **Gotchas**:

```
- Every product has at least one variant. Single-variant products have one variant with is_default = true; multi-variant products (v2.7+) have multiple variants. NEVER read stock/price/cost from products table — always from product_variants.
- The product_with_default_variant view is the bridge for single-variant UI. Reads through it look like the pre-v2.6 product shape. Will be deprecated once UI fully consumes variants directly.
- record_sale and record_purchase accept both variant_id (preferred) and product_id (legacy → resolves to default variant). New code passes variant_id. Eventually drop the product_id path.
- product_id columns on sale_items, purchase_items, product_packs are kept in sync from variant_id by a trigger. They are denormalized for backward compat with reports. Do not write to product_id directly.
- Stock decrements on product_variants.stock. NEVER on products.stock (deprecated). Every test must verify this.
```

---

*End of v2.6 spec.*
