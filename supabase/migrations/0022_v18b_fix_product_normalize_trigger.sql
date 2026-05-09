-- v1.8b — fix-up for v1.8 hardening
-- Bug found post-deploy: editing a product raised
--   42501 permission denied for function normalize_product_text
-- Cause: products_normalize_trigger is not SECURITY DEFINER, so it runs as the
-- calling user (authenticated). The trigger body calls
-- public.normalize_product_text(...), and v1.8 revoked EXECUTE on that helper
-- from authenticated. The trigger fired but the inner call was denied.
--
-- Fix: make the trigger SECURITY DEFINER. The function only mutates NEW.*
-- (whitespace trim) — no privilege-escalation surface. Same pattern as
-- ledger_entries_update_balance.

create or replace function public.products_normalize_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  new.name := public.normalize_product_text(new.name);
  new.type := public.normalize_product_text(new.type);
  if new.description is not null then
    new.description := trim(new.description);
    if new.description = '' then new.description := null; end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.products_normalize_trigger() from public, anon, authenticated;
