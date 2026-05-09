-- Seed development data for a single test shop.
--
-- Usage:
--   1. Sign up a test user in the app (e.g., dev@example.com).
--   2. Look up the user's id:
--        select id from auth.users where email = 'dev@example.com';
--   3. Replace <USER_ID> below with the result and run via SQL Editor or
--        mcp__supabase__execute_sql.
--
-- Idempotent: if the user has already onboarded, the script no-ops on shops/details.

do $$
declare
  v_user_id uuid := '<USER_ID>'::uuid;
  v_shop_id uuid;
begin
  if v_user_id is null then
    raise exception 'Replace <USER_ID> before running this script';
  end if;

  -- Onboarding (idempotent via ON CONFLICT)
  insert into public.shops (
    owner_user_id, shop_name, shop_address, shop_phone, shop_type
  )
  values (
    v_user_id,
    'Test Shop',
    '123 Mall Road, Lahore',
    '+923001234567',
    'Mobile shop'
  )
  on conflict (owner_user_id) do update
    set shop_name = excluded.shop_name
  returning id into v_shop_id;

  if v_shop_id is null then
    select id into v_shop_id from public.shops where owner_user_id = v_user_id;
  end if;

  insert into public.shop_owner_details (
    shop_id, owner_name, owner_phone, owner_cnic, owner_address
  )
  values (
    v_shop_id,
    'Test Owner',
    '+923001234567',
    '12345-1234567-1',
    '123 Mall Road, Lahore'
  )
  on conflict (shop_id) do nothing;

  update public.profiles
  set onboarding_completed = true, updated_at = now()
  where id = v_user_id;

  -- Sample products
  insert into public.products (shop_id, name, price, cost, stock)
  values
    (v_shop_id, 'Phone case A', 500, 200, 50),
    (v_shop_id, 'Phone case B', 750, 300, 30),
    (v_shop_id, 'Charger 20W', 1500, 800, 25),
    (v_shop_id, 'Earbuds basic', 2500, 1400, 10),
    (v_shop_id, 'Screen guard', 200, 80, 100)
  on conflict do nothing;

  -- Sample customers
  insert into public.customers (shop_id, name, phone)
  values
    (v_shop_id, 'Ali Khan', '+923011111111'),
    (v_shop_id, 'Sara Ahmad', '+923022222222'),
    (v_shop_id, 'Imran Raza', '+923033333333')
  on conflict (shop_id, phone) do nothing;

  -- Monthly target (current month)
  insert into public.monthly_targets (
    shop_id, month, target_sale, target_gross_profit, target_net_profit
  )
  values (
    v_shop_id,
    date_trunc('month', current_date)::date,
    100000, 30000, 20000
  )
  on conflict (shop_id, month) do nothing;

  -- Sample expense
  insert into public.expenses (shop_id, category, amount, expense_date, note, created_by)
  values (v_shop_id, 'rent', 25000, date_trunc('month', current_date)::date, 'Monthly rent', v_user_id)
  on conflict do nothing;

  raise notice 'Seeded shop_id %', v_shop_id;
end $$;
