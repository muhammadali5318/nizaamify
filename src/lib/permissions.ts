// Client-side permission resolution.
//
// Resolution pattern:
//   1. `useSelfPermissions()` queries the `get_user_permissions(auth.uid())`
//      RPC. The server resolves owner_implicit | preset | override | default
//      and returns the flat map for the current user.
//   2. `usePermission(key)` reads from the cached result.
//   3. Cache: staleTime 60s + refetchOnWindowFocus. When an owner
//      revokes a permission, affected staff see stale UI for up to 60s
//      (documented; see [[2026-05-13-rbac-client-cache-staleness-bounded]]
//      and B.6 — success snackbar surfaces this on revoke).
//
// The 50 PERMISSION_KEYS constants exactly match
// `supabase/migrations/0068_v29_foundation_enum_catalog.sql`.

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useSession } from 'src/features/auth/AuthProvider'
import { supabase } from 'src/lib/supabase'

// =====================================================================
// PERMISSION_KEYS — must match the catalog in migration 0068
// =====================================================================

export const PERMISSION_KEYS = {
  // SALES (5)
  record_sale: 'record_sale',
  view_all_sales: 'view_all_sales',
  view_sale_cost: 'view_sale_cost',
  view_profit_margin: 'view_profit_margin',
  reprint_receipt: 'reprint_receipt',
  // PRODUCTS (7)
  view_products: 'view_products',
  view_product_cost: 'view_product_cost',
  create_product: 'create_product',
  edit_product: 'edit_product',
  archive_product: 'archive_product',
  manage_product_categories: 'manage_product_categories',
  manage_product_packs: 'manage_product_packs',
  // INVENTORY (7)
  view_inventory_batches: 'view_inventory_batches',
  view_batch_cost: 'view_batch_cost',
  view_purchases: 'view_purchases',
  record_purchase: 'record_purchase',
  writeoff_batch: 'writeoff_batch',
  edit_product_expiry_overrides: 'edit_product_expiry_overrides',
  confirm_expired_sale_at_pos: 'confirm_expired_sale_at_pos',
  // CUSTOMERS (9)
  view_customers: 'view_customers',
  view_customer_contact: 'view_customer_contact',
  view_customer_outstanding: 'view_customer_outstanding',
  create_customer_basic: 'create_customer_basic',
  create_customer_full: 'create_customer_full',
  edit_customer: 'edit_customer',
  view_customer_khata: 'view_customer_khata',
  assign_customer_tier: 'assign_customer_tier',
  manage_customer_tiers: 'manage_customer_tiers',
  // SUPPLIERS (2)
  view_suppliers: 'view_suppliers',
  manage_suppliers: 'manage_suppliers',
  // FINANCIAL (8)
  receive_payment: 'receive_payment',
  reverse_ledger_entry: 'reverse_ledger_entry',
  view_expenses: 'view_expenses',
  create_expense: 'create_expense',
  edit_expense: 'edit_expense',
  view_monthly_targets: 'view_monthly_targets',
  manage_monthly_targets: 'manage_monthly_targets',
  view_reports: 'view_reports',
  // SETTINGS (5)
  edit_shop_settings: 'edit_shop_settings',
  view_owner_details: 'view_owner_details',
  edit_owner_details: 'edit_owner_details',
  manage_units_of_measure: 'manage_units_of_measure',
  manage_variant_attributes: 'manage_variant_attributes',
  // TEAM (7)
  view_team: 'view_team',
  invite_users: 'invite_users',
  cancel_invitations: 'cancel_invitations',
  modify_user_permissions: 'modify_user_permissions',
  modify_user_discount_limits: 'modify_user_discount_limits',
  revoke_user_access: 'revoke_user_access',
  view_user_audit_log: 'view_user_audit_log'
} as const

export type PermissionKey = keyof typeof PERMISSION_KEYS

// =====================================================================
// Hooks
// =====================================================================

type PermissionRow = {
  permission_key: string
  granted: boolean
  source: string // 'owner_implicit' | 'preset' | 'override' | 'default'
}

/**
 * Fetches the full permission map for the current user against the
 * active shop. Cached for 60s + revalidate-on-focus.
 *
 * Returns a `data` object keyed by permission_key → { granted, source }.
 * Returns null while loading or if there's no session.
 *
 * Owner gets all 50 keys with source='owner_implicit' (server resolves).
 */
export function useSelfPermissions() {
  const { user } = useSession()
  return useQuery({
    queryKey: ['permissions', 'self', user?.id],
    enabled: !!user,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!user) return null
      const { data, error } = await supabase.rpc('get_user_permissions', {
        p_target_user_id: user.id
      })
      if (error) throw error
      const map: Record<string, { granted: boolean; source: string }> = {}
      for (const row of (data ?? []) as PermissionRow[]) {
        map[row.permission_key] = {
          granted: row.granted,
          source: row.source
        }
      }
      return map
    }
  })
}

/**
 * Returns whether the current user has the given permission against
 * the active shop. Falls back to `false` while loading.
 *
 * Owner-implicit users return `true` for every key (server-resolved
 * via the `owner_implicit_shortcut` short-circuit in user_has_permission).
 */
export function usePermission(key: PermissionKey): boolean {
  const { data } = useSelfPermissions()
  return data?.[key]?.granted === true
}

/**
 * Bulk permission check. Returns a map keyed by the requested keys.
 * Single hook call regardless of N keys — saves render churn.
 */
export function usePermissions<K extends PermissionKey>(
  keys: readonly K[]
): Record<K, boolean> {
  const { data } = useSelfPermissions()
  return useMemo(() => {
    const out = {} as Record<K, boolean>
    for (const k of keys) {
      out[k] = data?.[k]?.granted === true
    }
    return out
  }, [data, keys])
}

/**
 * Returns whether the current user is the owner of the active shop.
 * Owner status drives several UX branches (settings sections visible,
 * cap-bypass on receive_payment, etc.).
 */
export function useIsOwner(): boolean {
  const { data } = useSelfPermissions()
  // The owner_implicit source is unique to owners — every key has it
  if (!data) return false
  // Pick any key; owner shortcuts every entry
  const sample = Object.values(data)[0]
  return sample?.source === 'owner_implicit'
}
