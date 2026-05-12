-- v2.8.4 fix — `preflight_expired_sale_check` raised
-- `column reference "variant_id" is ambiguous` because the RETURNS TABLE
-- declares an OUT parameter named `variant_id`, while the function body's
-- WHERE clauses (`where variant_id = v_variant_id`) referenced the
-- unqualified column on `inventory_batches`. Postgres can't tell whether
-- the bare name is the OUT param or the table column.
--
-- Fix: alias `inventory_batches` as `b` and qualify the column as
-- `b.variant_id` everywhere inside the function body. Signature
-- unchanged — CREATE OR REPLACE keeps existing grants.

create or replace function public.preflight_expired_sale_check(
  p_items jsonb default '[]'::jsonb
) returns table (
  variant_id uuid,
  would_draw_expired boolean,
  expired_batch_ids uuid[],
  policy public.expired_sale_policy
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_item jsonb;
  v_variant_id uuid;
  v_qty int;
  v_override_batch_id uuid;
  v_has_batches boolean;
  v_product_policy public.expired_sale_policy;
  v_effective_policy public.expired_sale_policy;
  v_non_expired_stock int;
  v_would_draw_expired boolean;
  v_expired_batch_ids uuid[];
  v_batch_expiry date;
begin
  if v_shop_id is null then return; end if;
  if jsonb_typeof(p_items) is null then p_items := '[]'::jsonb; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty <= 0 then continue; end if;

    if v_item ? 'variant_id' and nullif(v_item->>'variant_id', '') is not null then
      v_variant_id := (v_item->>'variant_id')::uuid;
    elsif v_item ? 'product_id' and nullif(v_item->>'product_id', '') is not null then
      select pv.id into v_variant_id
        from public.product_variants pv
       where pv.product_id = (v_item->>'product_id')::uuid
         and pv.is_default and pv.is_active;
      if v_variant_id is null then continue; end if;
    else
      continue;
    end if;

    select p.has_batches, p.expired_sale_policy
      into v_has_batches, v_product_policy
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
     where pv.id = v_variant_id
       and p.shop_id = v_shop_id;

    if not found then continue; end if;

    select coalesce(
      v_product_policy,
      (select default_expired_sale_policy from public.shops where id = v_shop_id),
      'warn'::public.expired_sale_policy
    ) into v_effective_policy;

    if not v_has_batches then
      variant_id := v_variant_id;
      would_draw_expired := false;
      expired_batch_ids := array[]::uuid[];
      policy := v_effective_policy;
      return next;
      continue;
    end if;

    v_override_batch_id := nullif(v_item->>'batch_id', '')::uuid;

    if v_override_batch_id is not null then
      select b.expiry_date into v_batch_expiry
        from public.inventory_batches b
       where b.id = v_override_batch_id
         and b.variant_id = v_variant_id
         and b.is_active;
      v_would_draw_expired := (v_batch_expiry is not null
                               and v_batch_expiry < current_date);
      if v_would_draw_expired then
        v_expired_batch_ids := array[v_override_batch_id];
      else
        v_expired_batch_ids := array[]::uuid[];
      end if;
    else
      select coalesce(sum(b.qty_remaining), 0)::int
        into v_non_expired_stock
        from public.inventory_batches b
       where b.variant_id = v_variant_id
         and b.is_active
         and b.qty_remaining > 0
         and (b.expiry_date is null or b.expiry_date >= current_date);

      v_would_draw_expired := (v_non_expired_stock < v_qty);

      if v_would_draw_expired then
        select coalesce(array_agg(b.id order by b.expiry_date desc), array[]::uuid[])
          into v_expired_batch_ids
          from public.inventory_batches b
         where b.variant_id = v_variant_id
           and b.is_active
           and b.qty_remaining > 0
           and b.expiry_date is not null
           and b.expiry_date < current_date;
      else
        v_expired_batch_ids := array[]::uuid[];
      end if;
    end if;

    variant_id := v_variant_id;
    would_draw_expired := v_would_draw_expired;
    expired_batch_ids := v_expired_batch_ids;
    policy := v_effective_policy;
    return next;
  end loop;
end;
$$;
