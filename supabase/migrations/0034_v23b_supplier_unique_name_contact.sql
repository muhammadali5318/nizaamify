-- 0034_v23b_supplier_unique_name_contact.sql
-- v2.3 follow-up — supplier uniqueness was overly strict.
-- Two real suppliers can legitimately share a display name ("Ali Traders" in
-- two different cities, etc.); v1.9 keyed the unique index on shop+name only.
-- Widen the key to (shop_id, name, contact) so a duplicate is only flagged
-- when *both* match. Empty/NULL contact is normalized to '' so two suppliers
-- with the same name and no contact still conflict (NULLs would otherwise
-- compare unequal and bypass the index).

-- ============================================================================
-- A. Replace the unique index
-- ============================================================================

drop index if exists public.uq_suppliers_shop_name;

create unique index if not exists uq_suppliers_shop_name_contact
  on public.suppliers (
    shop_id,
    lower(trim(name)),
    lower(trim(coalesce(contact, '')))
  )
  where is_active = true;

-- ============================================================================
-- B. Update create_supplier_inline duplicate check
-- ============================================================================

create or replace function public.create_supplier_inline(
  p_name text,
  p_contact text default null,
  p_address text default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid := public.current_shop_id();
  v_user_id uuid := auth.uid();
  v_supplier_id uuid;
  v_name text;
  v_contact_norm text;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if v_shop_id is null then raise exception 'no_shop_for_user'; end if;
  v_name := nullif(trim(coalesce(p_name,'')), '');
  if v_name is null then
    raise exception 'name_required' using errcode = 'P0001';
  end if;

  -- Duplicate is now (name, contact). NULL/empty contact normalizes to ''.
  v_contact_norm := lower(trim(coalesce(p_contact, '')));

  if exists (
    select 1 from public.suppliers
     where shop_id = v_shop_id
       and lower(trim(name)) = lower(v_name)
       and lower(trim(coalesce(contact, ''))) = v_contact_norm
       and is_active = true
  ) then
    raise exception 'duplicate_supplier_name_contact' using errcode = 'P0001';
  end if;

  insert into public.suppliers (shop_id, name, contact, address, notes)
  values (
    v_shop_id, v_name,
    nullif(trim(coalesce(p_contact,'')),''),
    nullif(trim(coalesce(p_address,'')),''),
    nullif(trim(coalesce(p_notes,'')),'')
  ) returning id into v_supplier_id;

  return v_supplier_id;
end;
$$;

revoke execute on function public.create_supplier_inline(text, text, text, text) from public, anon;
grant  execute on function public.create_supplier_inline(text, text, text, text) to authenticated;
