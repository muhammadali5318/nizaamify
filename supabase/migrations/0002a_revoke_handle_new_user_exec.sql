-- handle_new_user is invoked by the trigger only; revoke REST/RPC execute.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
