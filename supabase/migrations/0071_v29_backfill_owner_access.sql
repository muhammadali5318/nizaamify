
-- v2.9 Phase A migration 0071: backfill existing shops as owner rows
-- Idempotent via on-conflict
insert into public.user_shop_access (user_id, shop_id, is_owner)
select s.owner_user_id, s.id, true
  from public.shops s
 on conflict (user_id, shop_id) do nothing;
