
-- v2.9 Day-7 cutover migration 0079: final hygiene
-- Trigger functions already had their authenticated EXECUTE revoked in 0076.
-- Confirmation re-statement (idempotent) for documentation completeness.

revoke execute on function public.batch_immutable_fields() from public, anon, authenticated;
revoke execute on function public.batch_auto_deactivate_when_empty() from public, anon, authenticated;

-- Also verify no _v28 inner function leaked back to authenticated
-- (each _v28 was revoked in 0076; this re-states idempotently)
do $$
declare r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like '%\_v28' escape '\'
  loop
    execute format('revoke execute on function public.%I(%s) from public, anon, authenticated',
                   r.proname, r.args);
  end loop;
end $$;
