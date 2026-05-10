import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'
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
export type PurchaseLineInput =
  | { product_id: string; qty: number; cost_at_purchase: number }
  | {
      product_id: string
      pack_id: string
      pack_qty: number
      cost_at_purchase: number
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
        p_is_opening: false
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['purchases'] })
      void qc.invalidateQueries({ queryKey: ['purchase'] })
      void qc.invalidateQueries({ queryKey: ['products'] })
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
  avg_cost_before: number | null
  avg_cost_after: number | null
  /** v2.0 pack snapshot. Null on v1.x rows and on base-unit purchases. */
  pack_id: string | null
  pack_qty: number | null
  pack_base_qty_snapshot: number | null
  qty_in_base: number
  product: { id: string; name: string; type: string } | null
  pack: { id: string; unit_name: string; is_active: boolean } | null
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
  return useQuery({
    queryKey: ['purchase', id],
    enabled: !!id,
    queryFn: async (): Promise<PurchaseDetail | null> => {
      if (!id) return null
      const { data, error } = await supabase
        .from('purchases')
        .select(
          `
          *,
          cashier:profiles!purchases_cashier_id_fkey ( email ),
          supplier:suppliers ( name ),
          purchase_items (
            id, product_id, qty, cost_at_purchase, overhead_per_unit,
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
      const cashier = (data.cashier as { email: string } | null) ?? null
      const supplier = (data.supplier as { name: string } | null) ?? null
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
            Omit<PurchaseDetailItem, 'pack'> & {
              pack: {
                id: string
                is_active: boolean
                units_of_measure: { name: string } | null
              } | null
            }
          >
        ).map((it) => ({
          ...it,
          pack: it.pack
            ? {
                id: it.pack.id,
                unit_name: it.pack.units_of_measure?.name ?? '',
                is_active: it.pack.is_active
              }
            : null
        })),
        overhead:
          (data.purchase_overhead_items as unknown as PurchaseDetailOverhead[]) ??
          []
      }
    }
  })
}
