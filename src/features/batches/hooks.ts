import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'
import type { Database } from 'src/types/database'

export type InventoryBatch =
  Database['public']['Tables']['inventory_batches']['Row']

export type BatchPickerRow = {
  id: string
  batch_no: string
  qty_remaining: number
  expiry_date: string | null
  received_at: string
  cost_per_unit: number
}

/** Active batches for a variant, ordered FEFO. Used by:
 *   - POS pick-batch popover
 *   - product detail page (active list)
 */
export function useActiveBatchesForVariant(
  variantId: string | null | undefined
) {
  return useQuery({
    queryKey: ['batches', 'variant', variantId, 'active'],
    enabled: !!variantId,
    queryFn: async (): Promise<BatchPickerRow[]> => {
      if (!variantId) return []
      const { data, error } = await supabase
        .from('inventory_batches')
        .select(
          'id, batch_no, qty_remaining, expiry_date, received_at, cost_per_unit'
        )
        .eq('variant_id', variantId)
        .eq('is_active', true)
        .gt('qty_remaining', 0)
        // FEFO: expiry asc nulls last, then received_at asc — matches record_sale.
        .order('expiry_date', { ascending: true, nullsFirst: false })
        .order('received_at', { ascending: true })
      if (error) throw error
      return (data ?? []).map((r) => ({
        id: r.id,
        batch_no: r.batch_no,
        qty_remaining: r.qty_remaining,
        expiry_date: r.expiry_date,
        received_at: r.received_at,
        cost_per_unit: Number(r.cost_per_unit)
      }))
    }
  })
}

/** All batches for a variant (active + inactive). Used by product detail. */
export function useAllBatchesForVariant(variantId: string | null | undefined) {
  return useQuery({
    queryKey: ['batches', 'variant', variantId, 'all'],
    enabled: !!variantId,
    queryFn: async () => {
      if (!variantId) return []
      const { data, error } = await supabase
        .from('inventory_batches')
        .select(
          'id, batch_no, qty_received, qty_remaining, cost_per_unit, manufactured_date, expiry_date, supplier_warranty_days, warranty_expires_at, received_at, is_active, notes, supplier_id'
        )
        .eq('variant_id', variantId)
        .order('is_active', { ascending: false })
        .order('expiry_date', { ascending: true, nullsFirst: false })
        .order('received_at', { ascending: true })
      if (error) throw error
      return data ?? []
    }
  })
}

export type ExpiringBatchRow =
  Database['public']['Views']['batches_expiring_soon']['Row']

export type WarrantyExpiringBatchRow =
  Database['public']['Views']['batches_warranty_expiring_soon']['Row']

export function useExpiringSoon(limit = 10) {
  return useQuery({
    queryKey: ['alerts', 'expiring_soon', limit],
    queryFn: async (): Promise<ExpiringBatchRow[]> => {
      const { data, error } = await supabase
        .from('batches_expiring_soon')
        .select('*')
        .order('days_until_expiry', { ascending: true, nullsFirst: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as ExpiringBatchRow[]
    }
  })
}

export function useWarrantyExpiringSoon(limit = 10) {
  return useQuery({
    queryKey: ['alerts', 'warranty_expiring_soon', limit],
    queryFn: async (): Promise<WarrantyExpiringBatchRow[]> => {
      const { data, error } = await supabase
        .from('batches_warranty_expiring_soon')
        .select('*')
        .order('days_until_warranty_expires', {
          ascending: true,
          nullsFirst: false
        })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as WarrantyExpiringBatchRow[]
    }
  })
}

/** Used by the dashboard widget to decide whether to render at all —
 * the widget hides entirely when no product in the shop has has_batches. */
export function useHasAnyBatchedProduct() {
  return useQuery({
    queryKey: ['products', 'has_any_batched'],
    queryFn: async (): Promise<boolean> => {
      const { count, error } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('has_batches', true)
        .eq('is_active', true)
      if (error) throw error
      return (count ?? 0) > 0
    },
    staleTime: 60_000
  })
}

/** v2.8.2: partial write-off — remove `qty` units from a batch and from
 *  variant.stock atomically. When qty equals qty_remaining, the
 *  batch_auto_deactivate_when_empty trigger flips is_active=false in the
 *  same UPDATE. The frontend doesn't need to special-case the full
 *  write-off — always call this RPC. */
export function useRecordPartialWriteoff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      batch_id: string
      qty: number
      reason: string | null
    }) => {
      const { error } = await supabase.rpc('record_partial_writeoff', {
        p_batch_id: args.batch_id,
        p_qty: args.qty,
        p_reason: args.reason ?? undefined
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['batches'] })
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: ['product'] })
      void qc.invalidateQueries({ queryKey: ['alerts'] })
    }
  })
}

export function useDeactivateBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { batch_id: string; reason: string | null }) => {
      const { error } = await supabase.rpc('deactivate_batch', {
        p_batch_id: args.batch_id,
        p_reason: args.reason ?? undefined
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['batches'] })
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: ['product'] })
      void qc.invalidateQueries({ queryKey: ['alerts'] })
    }
  })
}

export type ShopAlertDefaults = {
  default_expiry_alert_days: number
  default_warranty_alert_days: number
}

export function useShopAlertDefaults() {
  return useQuery({
    queryKey: ['shop', 'alert_defaults'],
    queryFn: async (): Promise<ShopAlertDefaults | null> => {
      const { data, error } = await supabase
        .from('shops')
        .select('default_expiry_alert_days, default_warranty_alert_days')
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return {
        default_expiry_alert_days: data.default_expiry_alert_days,
        default_warranty_alert_days: data.default_warranty_alert_days
      }
    },
    staleTime: 60_000
  })
}

export function useUpdateShopAlertDefaults() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: ShopAlertDefaults) => {
      const { error } = await supabase
        .from('shops')
        .update({
          default_expiry_alert_days: args.default_expiry_alert_days,
          default_warranty_alert_days: args.default_warranty_alert_days
        })
        .eq(
          'owner_user_id',
          (await supabase.auth.getUser()).data.user?.id ?? ''
        )
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['shop'] })
      void qc.invalidateQueries({ queryKey: ['alerts'] })
    }
  })
}

/** Pre-fill batch number suggestion. UI may override. */
export async function suggestBatchNo(
  variantId: string,
  receivedAt: string
): Promise<string> {
  const { data, error } = await supabase.rpc('suggest_batch_no', {
    p_variant_id: variantId,
    p_received_at: receivedAt
  })
  if (error) throw error
  return (data as string) ?? ''
}
