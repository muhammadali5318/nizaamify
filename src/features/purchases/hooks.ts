import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'
import { useSession } from 'src/features/auth/AuthProvider'
import type { Database } from 'src/types/database'

export type Purchase = Database['public']['Tables']['purchases']['Row']
export type PurchaseItem = Database['public']['Tables']['purchase_items']['Row']
export type PurchaseOverheadItem =
  Database['public']['Tables']['purchase_overhead_items']['Row']

export type OverheadCategory =
  | 'delivery'
  | 'labor'
  | 'customs'
  | 'packaging'
  | 'other'

/**
 * One item in a stock-in. Two valid shapes:
 *   - Base unit:  { product_id, qty, cost_at_purchase }
 *   - Pack:       { product_id, pack_id, pack_qty, cost_at_purchase }
 * `record_purchase` accepts either; the pack variant is required for v2.0
 * stock-in-only packs (price=null) where qty is in cartons not base units.
 */
// v2.6+v2.7: lines may carry variant_id (multi-variant products) OR product_id
// (single-variant fallback resolved server-side to the default variant).
// v2.8: when the variant's product has has_batches = true, the line MUST also
// carry a `batch` object. record_purchase raises otherwise.
export type PurchaseBatchInput = {
  batch_no: string
  manufactured_date?: string | null
  expiry_date?: string | null
  supplier_warranty_days?: number | null
}
export type PurchaseLineInput =
  | {
      product_id: string
      variant_id?: string
      qty: number
      cost_at_purchase: number
      batch?: PurchaseBatchInput
    }
  | {
      product_id: string
      variant_id?: string
      pack_id: string
      pack_qty: number
      cost_at_purchase: number
      batch?: PurchaseBatchInput
    }

export type RecordPurchaseInput = {
  supplier_id: string | null
  purchase_date: string // YYYY-MM-DD
  note: string | null
  items: PurchaseLineInput[]
  overhead_items: {
    category: OverheadCategory
    amount: number
    description?: string | null
  }[]
  /** v2.8.1: when true, the resulting purchase row carries is_opening=true.
   * Used for the first stock-in of a product (catalog upload → first
   * delivery). Audit-only flag — `record_purchase` math is unchanged. */
  is_opening?: boolean
}

export function useRecordPurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: RecordPurchaseInput) => {
      const { data, error } = await supabase.rpc('record_purchase', {
        p_supplier_id: input.supplier_id ?? undefined,
        p_purchase_date: input.purchase_date,
        p_note: input.note ?? undefined,
        p_items:
          input.items as unknown as Database['public']['Tables']['purchases']['Insert'] extends Record<
            string,
            unknown
          >
            ? object
            : never,
        p_overhead_items: input.overhead_items as unknown as object,
        p_is_opening: input.is_opening ?? false
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['purchases'] })
      void qc.invalidateQueries({ queryKey: ['purchase'] })
      void qc.invalidateQueries({ queryKey: ['products'] })
      // v2.8.5: same stale-cache fix as useRecordSale — purchases mint new
      // batches and bump qty_remaining on existing ones; the product detail
      // page and POS batch picker both need to see the new state without
      // a hard reload.
      void qc.invalidateQueries({ queryKey: ['product'] })
      void qc.invalidateQueries({ queryKey: ['batches'] })
      void qc.invalidateQueries({ queryKey: ['alerts'] })
    }
  })
}

export type PurchaseListRow = {
  id: string
  purchase_date: string
  supplier_id: string | null
  supplier_name: string | null
  source: string | null
  note: string | null
  items_count: number
  items_subtotal: number
  overhead_subtotal: number
  total_cost: number
  is_opening: boolean
}

export function useSearchPurchases(args: {
  from: string | null
  to: string | null
  supplierId: string | null
  includeOpening: boolean
  page: number
  pageSize?: number
}) {
  const { from, to, supplierId, includeOpening, page, pageSize = 10 } = args
  return useQuery({
    queryKey: [
      'purchases',
      'search',
      { from, to, supplierId, includeOpening, page, pageSize }
    ],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<{ rows: PurchaseListRow[]; total: number }> => {
      const [rowsRes, countRes] = await Promise.all([
        supabase.rpc('search_purchases', {
          p_from: from ?? undefined,
          p_to: to ?? undefined,
          p_supplier_id: supplierId ?? undefined,
          p_include_opening: includeOpening,
          p_limit: pageSize,
          p_offset: page * pageSize
        }),
        supabase.rpc('search_purchases_count', {
          p_from: from ?? undefined,
          p_to: to ?? undefined,
          p_supplier_id: supplierId ?? undefined,
          p_include_opening: includeOpening
        })
      ])
      if (rowsRes.error) throw rowsRes.error
      if (countRes.error) throw countRes.error
      return {
        rows: (rowsRes.data ?? []) as PurchaseListRow[],
        total: Number(countRes.data ?? 0)
      }
    }
  })
}

export type PurchaseDetailItem = {
  id: string
  product_id: string
  qty: number
  cost_at_purchase: number
  overhead_per_unit: number
  /** v2.3: source-of-truth line-level overhead allocation (largest-remainder).
   * 0 on legacy rows; UI falls back to overhead_per_unit × qty_in_base. */
  line_overhead_amount: number
  avg_cost_before: number | null
  avg_cost_after: number | null
  /** v2.0 pack snapshot. Null on v1.x rows and on base-unit purchases. */
  pack_id: string | null
  pack_qty: number | null
  pack_base_qty_snapshot: number | null
  qty_in_base: number
  product: { id: string; name: string; type: string } | null
  pack: { id: string; unit_name: string; is_active: boolean } | null
  /** v2.6c: server-computed line subtotal (invoiced units × cost_at_purchase).
   * Single source of truth = purchase_item_financials view. */
  line_subtotal: number
  /** v2.6c: server-computed effective line overhead. Uses
   * line_overhead_amount when present, else falls back to
   * overhead_per_unit × qty_in_base for legacy rows. */
  line_overhead: number
  /** v2.6c: server-computed line total (line_subtotal + line_overhead). */
  line_total: number
  /** v2.6c: server-computed cost delta (avg_cost_after − avg_cost_before).
   * Null on legacy rows where snapshots are absent. */
  cost_delta: number | null
}

export type PurchaseDetailOverhead = {
  id: string
  category: OverheadCategory
  amount: number
  description: string | null
}

export type PurchaseDetail = Purchase & {
  cashier_email: string | null
  supplier_name: string | null
  items: PurchaseDetailItem[]
  overhead: PurchaseDetailOverhead[]
}

export function usePurchaseDetail(id: string | undefined) {
  const { user } = useSession()
  return useQuery({
    queryKey: ['purchase', id, user?.id],
    enabled: !!id,
    queryFn: async (): Promise<PurchaseDetail | null> => {
      if (!id) return null
      // v2.9.1 hot-patch — same fix as useSale: profiles team-read RLS is
      // gone (mig 0083), so the implicit cashier:profiles join returns
      // NULL whenever the viewer isn't the cashier. Resolve separately
      // via get_team_member_profiles (DEFINER, view_team) with self-fallback.
      const { data, error } = await supabase
        .from('purchases')
        .select(
          `
          *,
          supplier:suppliers ( name ),
          purchase_items (
            id, product_id, qty, cost_at_purchase, overhead_per_unit,
            line_overhead_amount,
            avg_cost_before, avg_cost_after,
            pack_id, pack_qty, pack_base_qty_snapshot, qty_in_base,
            product:products ( id, name, type ),
            pack:product_packs ( id, is_active, units_of_measure:unit_id ( name ) )
          ),
          purchase_overhead_items (
            id, category, amount, description
          )
          `
        )
        .eq('id', id)
        .single()
      if (error) throw error
      const cashierId = (data as { cashier_id: string | null }).cashier_id
      let cashier: { email: string } | null = null
      if (cashierId) {
        if (cashierId === user?.id) {
          cashier = { email: user.email ?? '—' }
        } else {
          const { data: profiles } = await supabase.rpc(
            'get_team_member_profiles',
            { p_user_ids: [cashierId] }
          )
          const email = (profiles as Array<{ email: string }> | null)?.[0]
            ?.email
          cashier = email ? { email } : null
        }
      }
      const supplier = (data.supplier as { name: string } | null) ?? null

      // v2.6c: parallel fetch server-computed per-line financials.
      // Single source of truth = purchase_item_financials view.
      type PFinRow = {
        purchase_item_id: string
        line_subtotal: number | string
        line_overhead: number | string
        line_total: number | string
        cost_delta: number | string | null
      }
      const { data: finRows, error: finErr } = await supabase
        .from('purchase_item_financials')
        .select(
          'purchase_item_id, line_subtotal, line_overhead, line_total, cost_delta'
        )
        .eq('purchase_id', data.id)
      if (finErr) throw finErr
      const finById = new Map<string, PFinRow>()
      for (const r of (finRows ?? []) as PFinRow[]) {
        finById.set(r.purchase_item_id, r)
      }

      return {
        id: data.id,
        shop_id: data.shop_id,
        supplier_id: data.supplier_id,
        total_cost: data.total_cost,
        items_subtotal: data.items_subtotal,
        overhead_subtotal: data.overhead_subtotal,
        source: data.source,
        note: data.note,
        purchase_date: data.purchase_date,
        cashier_id: data.cashier_id,
        created_at: data.created_at,
        is_opening: data.is_opening,
        cashier_email: cashier?.email ?? null,
        supplier_name: supplier?.name ?? null,
        items: (
          (data.purchase_items ?? []) as unknown as Array<
            Omit<
              PurchaseDetailItem,
              | 'pack'
              | 'line_subtotal'
              | 'line_overhead'
              | 'line_total'
              | 'cost_delta'
            > & {
              pack: {
                id: string
                is_active: boolean
                units_of_measure: { name: string } | null
              } | null
            }
          >
        ).map((it) => {
          const fin = finById.get(it.id)
          return {
            ...it,
            pack: it.pack
              ? {
                  id: it.pack.id,
                  unit_name: it.pack.units_of_measure?.name ?? '',
                  is_active: it.pack.is_active
                }
              : null,
            line_subtotal: Number(fin?.line_subtotal ?? 0),
            line_overhead: Number(fin?.line_overhead ?? 0),
            line_total: Number(fin?.line_total ?? 0),
            cost_delta:
              fin?.cost_delta === null || fin?.cost_delta === undefined
                ? null
                : Number(fin.cost_delta)
          }
        }),
        overhead:
          (data.purchase_overhead_items as unknown as PurchaseDetailOverhead[]) ??
          []
      }
    }
  })
}
