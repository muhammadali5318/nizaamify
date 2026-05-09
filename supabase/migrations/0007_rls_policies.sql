-- shop_owner_details: depend on current_shop_id() helper from 0005
drop policy if exists "owner_details_read" on public.shop_owner_details;
create policy "owner_details_read" on public.shop_owner_details
  for select using (shop_id = public.current_shop_id());

drop policy if exists "owner_details_update" on public.shop_owner_details;
create policy "owner_details_update" on public.shop_owner_details
  for update using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());

-- products
drop policy if exists "products_shop_all" on public.products;
create policy "products_shop_all" on public.products
  for all using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());

-- customers
drop policy if exists "customers_shop_all" on public.customers;
create policy "customers_shop_all" on public.customers
  for all using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());

-- invoices
drop policy if exists "invoices_shop_all" on public.invoices;
create policy "invoices_shop_all" on public.invoices
  for all using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());

-- sale_items: scoped via parent invoice
drop policy if exists "sale_items_shop_all" on public.sale_items;
create policy "sale_items_shop_all" on public.sale_items
  for all using (
    exists (
      select 1 from public.invoices i
      where i.id = sale_items.invoice_id
        and i.shop_id = public.current_shop_id()
    )
  )
  with check (
    exists (
      select 1 from public.invoices i
      where i.id = sale_items.invoice_id
        and i.shop_id = public.current_shop_id()
    )
  );

-- ledger_entries
drop policy if exists "ledger_shop_all" on public.ledger_entries;
create policy "ledger_shop_all" on public.ledger_entries
  for all using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());

-- purchases
drop policy if exists "purchases_shop_all" on public.purchases;
create policy "purchases_shop_all" on public.purchases
  for all using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());

-- purchase_items: scoped via parent purchase
drop policy if exists "purchase_items_shop_all" on public.purchase_items;
create policy "purchase_items_shop_all" on public.purchase_items
  for all using (
    exists (
      select 1 from public.purchases p
      where p.id = purchase_items.purchase_id
        and p.shop_id = public.current_shop_id()
    )
  )
  with check (
    exists (
      select 1 from public.purchases p
      where p.id = purchase_items.purchase_id
        and p.shop_id = public.current_shop_id()
    )
  );

-- expenses
drop policy if exists "expenses_shop_all" on public.expenses;
create policy "expenses_shop_all" on public.expenses
  for all using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());

-- monthly_targets
drop policy if exists "monthly_targets_shop_all" on public.monthly_targets;
create policy "monthly_targets_shop_all" on public.monthly_targets
  for all using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id());
