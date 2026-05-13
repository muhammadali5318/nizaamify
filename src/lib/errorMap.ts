// Central error-message → i18n key dispatch.
//
// Per Phase C ADR `2026-05-13-v291-error-dispatch-message-text.md`:
// the frontend matches on the Postgres exception **message text**, not
// SQLSTATE. Reason: all 144 controlled raises in v2.9 RPCs use the
// default SQLSTATE 'P0001'; differentiation lives in the message text.
//
// Revisability: if maintenance burden becomes real in v2.9.2+, the
// alternative (adding `using errcode = '<distinct_code>'` to inner-body
// raises) remains available as a one-time migration. We chose
// status-quo for v2.9.1; we did NOT foreclose the alternative.
//
// Frontend usage:
//   import { mapErrorToI18nKey } from 'src/lib/errorMap'
//   try { await supabase.rpc(...) }
//   catch (e) { showToast(t(mapErrorToI18nKey(e))) }
//
// The map keys are server message strings (verbatim from RAISE
// EXCEPTION statements). Values are i18n keys resolved against the
// `common` namespace. Extracted via:
//   grep -rEoh "raise exception '[a-z_]+'" supabase/migrations/*.sql

const ERROR_KEY_MAP: Record<string, string> = {
  // Universal RPC errors
  not_authenticated: 'errors.not_authenticated',
  no_shop_for_user: 'errors.no_shop_for_user',
  insufficient_permissions: 'errors.insufficient_permissions',
  invalid_app_shop_id_header: 'errors.invalid_app_shop_id_header',
  no_access_to_shop: 'errors.no_access_to_shop',

  // Auth / invitation
  already_a_member_at_this_shop: 'errors.already_a_member_at_this_shop',
  already_owner_at_this_email_user_combo:
    'errors.already_owner_at_this_email_user_combo',
  cannot_invite_owner: 'errors.cannot_invite_owner',
  cannot_modify_owner_or_unknown_user:
    'errors.cannot_modify_owner_or_unknown_user',
  cannot_modify_own_permissions: 'errors.cannot_modify_own_permissions',
  cannot_revoke_own_access: 'errors.cannot_revoke_own_access',
  cannot_revoke_owner_or_unknown_user:
    'errors.cannot_revoke_owner_or_unknown_user',
  cannot_revoke_required_permission: 'errors.cannot_revoke_required_permission',
  invalid_confirmation_code: 'errors.invalid_confirmation_code',
  invalid_email: 'errors.invalid_email',
  invalid_preset: 'errors.invalid_preset',
  invitation_email_mismatch: 'errors.invitation_email_mismatch',
  invitation_expired: 'errors.invitation_expired',
  invitation_not_found: 'errors.invitation_not_found',
  invitation_not_in_shop: 'errors.invitation_not_in_shop',
  invitation_not_pending: 'errors.invitation_not_pending',
  permission_dependency_missing: 'errors.permission_dependency_missing',
  unknown_permission_key: 'errors.unknown_permission_key',

  // Sale / POS / discount
  amount_paid_exceeds_total: 'errors.amount_paid_exceeds_total',
  amount_paid_negative: 'errors.amount_paid_negative',
  customer_required_for_credit: 'errors.customer_required_for_credit',
  default_sale_needs_price: 'errors.default_sale_needs_price',
  discount_exceeds_invoice_pct_limit:
    'errors.discount_exceeds_invoice_pct_limit',
  discount_exceeds_invoice_pkr_limit:
    'errors.discount_exceeds_invoice_pkr_limit',
  discount_exceeds_line_pct_limit: 'errors.discount_exceeds_line_pct_limit',
  discount_exceeds_line_pkr_limit: 'errors.discount_exceeds_line_pkr_limit',
  implicit_discount_exceeds_line_pct_limit:
    'errors.implicit_discount_exceeds_line_pct_limit',
  invalid_line_discount_type: 'errors.invalid_line_discount_type',
  invalid_sale_discount_type: 'errors.invalid_sale_discount_type',
  invalid_status: 'errors.invalid_status',
  invalid_override_type: 'errors.invalid_override_type',
  item_missing_variant_or_product_id:
    'errors.item_missing_variant_or_product_id',
  line_discount_exceeds_line_subtotal:
    'errors.line_discount_exceeds_line_subtotal',
  line_discount_fixed_negative: 'errors.line_discount_fixed_negative',
  line_discount_percent_out_of_range:
    'errors.line_discount_percent_out_of_range',
  override_fixed_exceeds_items_subtotal:
    'errors.override_fixed_exceeds_items_subtotal',
  override_fixed_negative: 'errors.override_fixed_negative',
  override_percent_out_of_range: 'errors.override_percent_out_of_range',
  override_type_and_value_must_both_be_set_or_neither:
    'errors.override_type_and_value_must_both_be_set_or_neither',
  sale_discount_fixed_exceeds_items_subtotal:
    'errors.sale_discount_fixed_exceeds_items_subtotal',
  sale_discount_fixed_negative: 'errors.sale_discount_fixed_negative',
  sale_discount_percent_out_of_range:
    'errors.sale_discount_percent_out_of_range',
  sale_discount_type_and_value_must_both_be_set_or_neither:
    'errors.sale_discount_type_and_value_must_both_be_set_or_neither',
  service_charge_negative: 'errors.service_charge_negative',
  salesperson_payment_cap_exceeded: 'errors.salesperson_payment_cap_exceeded',

  // Customer / khata
  customer_not_found: 'errors.customer_not_found',
  customer_not_in_shop: 'errors.customer_not_in_shop',
  duplicate_phone_in_shop: 'errors.duplicate_phone_in_shop',
  invoice_already_settled: 'errors.invoice_already_settled',
  invoice_not_for_customer: 'errors.invoice_not_for_customer',
  amount_invalid: 'errors.amount_invalid',
  amount_must_be_positive: 'errors.amount_must_be_positive',

  // Ledger reversal
  cannot_reverse_a_reversal: 'errors.cannot_reverse_a_reversal',
  cannot_reverse_invoice_tied_debit: 'errors.cannot_reverse_invoice_tied_debit',
  entry_already_reversed: 'errors.entry_already_reversed',
  entry_not_in_shop: 'errors.entry_not_in_shop',

  // Customer tier
  cannot_archive_default_tier: 'errors.cannot_archive_default_tier',
  cannot_unset_default_tier: 'errors.cannot_unset_default_tier',
  tier_archived: 'errors.tier_archived',
  tier_discount_out_of_range: 'errors.tier_discount_out_of_range',
  tier_name_duplicate: 'errors.tier_name_duplicate',
  tier_name_required: 'errors.tier_name_required',
  tier_not_in_shop: 'errors.tier_not_in_shop',

  // Product / variant / category
  attribute_already_exists: 'errors.attribute_already_exists',
  attribute_composition_mismatch: 'errors.attribute_composition_mismatch',
  attribute_in_use_cannot_archive: 'errors.attribute_in_use_cannot_archive',
  attribute_name_blank: 'errors.attribute_name_blank',
  attribute_not_found: 'errors.attribute_not_found',
  attribute_not_in_shop_or_inactive: 'errors.attribute_not_in_shop_or_inactive',
  attribute_value_invalid_for_this_product:
    'errors.attribute_value_invalid_for_this_product',
  cannot_set_default_on_multi_variant_product:
    'errors.cannot_set_default_on_multi_variant_product',
  category_already_exists: 'errors.category_already_exists',
  category_name_blank: 'errors.category_name_blank',
  category_not_found: 'errors.category_not_found',
  category_not_in_shop: 'errors.category_not_in_shop',
  category_required: 'errors.category_required',
  cost_must_be_non_negative: 'errors.cost_must_be_non_negative',
  default_variant_missing: 'errors.default_variant_missing',
  duplicate_variant_combination: 'errors.duplicate_variant_combination',
  is_active_required: 'errors.is_active_required',
  multi_variant_price_split: 'errors.multi_variant_price_split',
  name_required: 'errors.name_required',
  one_or_more_attributes_invalid: 'errors.one_or_more_attributes_invalid',
  opening_cost_negative: 'errors.opening_cost_negative',
  opening_cost_required_when_stock_positive:
    'errors.opening_cost_required_when_stock_positive',
  opening_stock_negative: 'errors.opening_stock_negative',
  phone_required: 'errors.phone_required',
  price_negative: 'errors.price_negative',
  product_has_no_default_variant: 'errors.product_has_no_default_variant',
  product_is_single_variant: 'errors.product_is_single_variant',
  product_must_have_at_least_one_priced_unit:
    'errors.product_must_have_at_least_one_priced_unit',
  product_not_found: 'errors.product_not_found',
  product_not_in_shop: 'errors.product_not_in_shop',
  too_many_attributes: 'errors.too_many_attributes',
  value_already_exists: 'errors.value_already_exists',
  value_blank: 'errors.value_blank',
  value_in_use_cannot_archive: 'errors.value_in_use_cannot_archive',
  value_not_found: 'errors.value_not_found',
  value_not_in_shop: 'errors.value_not_in_shop',
  variant_must_have_one_value_per_attribute:
    'errors.variant_must_have_one_value_per_attribute',
  variant_not_found: 'errors.variant_not_found',
  variant_not_found_or_inactive: 'errors.variant_not_found_or_inactive',
  variant_not_in_shop: 'errors.variant_not_in_shop',
  variant_not_sellable: 'errors.variant_not_sellable',
  variant_price_negative: 'errors.variant_price_negative',
  variants_required_when_attributes_set:
    'errors.variants_required_when_attributes_set',

  // Pack / UoM
  base_qty_invalid: 'errors.base_qty_invalid',
  base_qty_must_be_greater_than_one: 'errors.base_qty_must_be_greater_than_one',
  invalid_unit_code: 'errors.invalid_unit_code',
  pack_not_found_or_inactive: 'errors.pack_not_found_or_inactive',
  pack_not_found_or_not_in_shop: 'errors.pack_not_found_or_not_in_shop',
  pack_not_in_shop: 'errors.pack_not_in_shop',
  pack_qty_must_be_positive: 'errors.pack_qty_must_be_positive',
  unit_not_in_shop: 'errors.unit_not_in_shop',

  // Batch / inventory
  batch_cost_immutable: 'errors.batch_cost_immutable',
  batch_expiry_immutable: 'errors.batch_expiry_immutable',
  batch_id_immutable: 'errors.batch_id_immutable',
  batch_info_required_for_batched_product:
    'errors.batch_info_required_for_batched_product',
  batch_mfg_date_immutable: 'errors.batch_mfg_date_immutable',
  batch_no_immutable: 'errors.batch_no_immutable',
  batch_no_required: 'errors.batch_no_required',
  batch_not_in_shop: 'errors.batch_not_in_shop',
  batch_not_in_shop_or_inactive: 'errors.batch_not_in_shop_or_inactive',
  batch_not_in_variant_or_inactive: 'errors.batch_not_in_variant_or_inactive',
  batch_purchase_item_immutable: 'errors.batch_purchase_item_immutable',
  batch_qty_received_immutable: 'errors.batch_qty_received_immutable',
  batch_received_at_immutable: 'errors.batch_received_at_immutable',
  batch_supplier_immutable: 'errors.batch_supplier_immutable',
  batch_variant_immutable: 'errors.batch_variant_immutable',
  batch_warranty_date_immutable: 'errors.batch_warranty_date_immutable',
  batch_warranty_days_immutable: 'errors.batch_warranty_days_immutable',
  cannot_seed_opening_stock_for_batched_product:
    'errors.cannot_seed_opening_stock_for_batched_product',
  duplicate_batch_no: 'errors.duplicate_batch_no',
  expired_stock_blocked: 'errors.expired_stock_blocked',
  expired_stock_needs_confirmation: 'errors.expired_stock_needs_confirmation',
  expiry_alert_days_must_be_positive:
    'errors.expiry_alert_days_must_be_positive',
  qty_exceeds_remaining: 'errors.qty_exceeds_remaining',
  qty_must_be_positive: 'errors.qty_must_be_positive',
  selected_batch_insufficient: 'errors.selected_batch_insufficient',
  warranty_alert_days_must_be_positive:
    'errors.warranty_alert_days_must_be_positive',

  // Purchase
  empty_purchase: 'errors.empty_purchase',
  invalid_overhead_category: 'errors.invalid_overhead_category',
  overhead_amount_must_be_positive: 'errors.overhead_amount_must_be_positive',

  // Supplier
  duplicate_supplier_name: 'errors.duplicate_supplier_name',
  duplicate_supplier_name_contact: 'errors.duplicate_supplier_name_contact',
  supplier_not_found: 'errors.supplier_not_found',
  supplier_not_in_shop: 'errors.supplier_not_in_shop',

  // Expense
  expense_edit_window_expired: 'errors.expense_edit_window_expired',
  expense_not_in_shop: 'errors.expense_not_in_shop',
  not_expense_creator: 'errors.not_expense_creator',

  // Pagination
  limit_out_of_range: 'errors.limit_out_of_range',
  offset_invalid: 'errors.offset_invalid'
}

/**
 * Maps a Supabase/Postgres error to an i18n key string.
 *
 * Strategy:
 *  1. Try direct match of `err.message` against the catalog.
 *  2. Strip optional `P0001:` prefix, retry direct match.
 *  3. Fall back to `errors.unknown`.
 *
 * The matched value is an i18n key under the `common` namespace —
 * caller passes it to `t()` to get the localized user-facing message.
 */
export function mapErrorToI18nKey(err: unknown): string {
  if (err == null) return 'errors.unknown'
  const message =
    (err as { message?: string })?.message ??
    (typeof err === 'string' ? err : '')
  const trimmed = message.trim()
  if (!trimmed) return 'errors.unknown'

  // Direct match
  if (trimmed in ERROR_KEY_MAP) return ERROR_KEY_MAP[trimmed]

  // Strip "P0001: " (or similar SQLSTATE prefix) and try again
  const m = trimmed.match(/(?:^[A-Z0-9]{5}[:\s]+)?([a-z][a-z0-9_]*)/)
  if (m?.[1] && m[1] in ERROR_KEY_MAP) return ERROR_KEY_MAP[m[1]]

  return 'errors.unknown'
}

/** Whether the given error indicates the user lacks permission. */
export function isPermissionError(err: unknown): boolean {
  return mapErrorToI18nKey(err) === 'errors.insufficient_permissions'
}

/** Whether the given error indicates the active-shop header is bad. */
export function isShopAccessError(err: unknown): boolean {
  const key = mapErrorToI18nKey(err)
  return (
    key === 'errors.no_shop_for_user' ||
    key === 'errors.no_access_to_shop' ||
    key === 'errors.invalid_app_shop_id_header'
  )
}

/** Whether the given error indicates the user must re-authenticate. */
export function isAuthError(err: unknown): boolean {
  return mapErrorToI18nKey(err) === 'errors.not_authenticated'
}

/**
 * Extracts the `detail` field from a Supabase error if present.
 * v2.9 RPCs frequently set `detail = 'Required: <permission_key>'`
 * on insufficient_permissions errors; useful for tooltips.
 */
export function getErrorDetail(err: unknown): string | null {
  const detail = (err as { details?: string; detail?: string })?.details
  if (typeof detail === 'string') return detail
  const alt = (err as { detail?: string })?.detail
  return typeof alt === 'string' ? alt : null
}
