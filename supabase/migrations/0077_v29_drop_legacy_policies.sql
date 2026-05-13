
-- v2.9 Day-7 cutover migration 0077: drop legacy v2.8.5 RLS policies (now superseded by v29_*).
-- After this, the permission-based gates are the only RLS layer.
-- The current_shop_id() v2.8.5 body is still preserved here; permanent alias happens in 0078
-- once we've verified the cutover holds.

drop policy if exists shops_owner_read on public.shops;
drop policy if exists shops_owner_update on public.shops;
drop policy if exists owner_details_read on public.shop_owner_details;
drop policy if exists owner_details_update on public.shop_owner_details;
drop policy if exists products_shop_all on public.products;
drop policy if exists variants_shop_read on public.product_variants;
drop policy if exists variants_shop_write on public.product_variants;
drop policy if exists batches_shop_read on public.inventory_batches;
drop policy if exists batches_shop_write on public.inventory_batches;
drop policy if exists suppliers_shop_read on public.suppliers;
drop policy if exists suppliers_shop_write on public.suppliers;
drop policy if exists customers_shop_all on public.customers;
drop policy if exists invoices_shop_all on public.invoices;
drop policy if exists sale_items_shop_all on public.sale_items;
drop policy if exists purchases_shop_all on public.purchases;
drop policy if exists purchase_items_shop_all on public.purchase_items;
drop policy if exists overhead_shop_read on public.purchase_overhead_items;
drop policy if exists overhead_shop_write on public.purchase_overhead_items;
drop policy if exists ledger_select_shop on public.ledger_entries;
drop policy if exists ledger_insert_shop on public.ledger_entries;
drop policy if exists expenses_shop_all on public.expenses;
drop policy if exists monthly_targets_shop_all on public.monthly_targets;
drop policy if exists categories_shop_read on public.product_categories;
drop policy if exists categories_shop_write on public.product_categories;
drop policy if exists packs_shop_read on public.product_packs;
drop policy if exists packs_shop_write on public.product_packs;
drop policy if exists pvav_shop_read on public.product_variant_attribute_values;
drop policy if exists pvav_shop_write on public.product_variant_attribute_values;
drop policy if exists variant_attr_shop_read on public.variant_attributes;
drop policy if exists variant_attr_shop_write on public.variant_attributes;
drop policy if exists variant_values_shop_read on public.variant_attribute_values;
drop policy if exists variant_values_shop_write on public.variant_attribute_values;
drop policy if exists tiers_shop_read on public.customer_tiers;
drop policy if exists tiers_shop_write on public.customer_tiers;
drop policy if exists uom_shop_read on public.units_of_measure;
drop policy if exists uom_shop_write on public.units_of_measure;

-- Replacement for units_of_measure direct DML (no v2.9 RPC for create/edit UoM; gate on permission)
create policy v29_uom_manage_write on public.units_of_measure
  for all using (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'manage_units_of_measure'))
  ) with check (
    shop_id = (select public.current_active_shop_id())
    and (select public.user_has_permission(shop_id, 'manage_units_of_measure'))
  );
