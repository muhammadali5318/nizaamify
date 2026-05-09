import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'
import type { Database } from 'src/types/database'

export type Purchase = Database['public']['Tables']['purchases']['Row']

type PurchaseItemInput = {
  product_id: string
  qty: number
  cost: number
}

export type PurchaseDetailItem = {
  id: string
  product_id: string
  qty: number
  cost_at_purchase: number
  product: {
    id: string
    name: string
    avg_cost: number
    last_purchase_cost: number | null
  } | null
}

export type PurchaseDetail = Purchase & {
  cashier_email: string | null
  items: PurchaseDetailItem[]
}

export function usePurchases() {
  return useQuery({
    queryKey: ['purchases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchases')
        .select('*, purchase_items(qty)')
        .order('purchase_date', { ascending: false })
        .limit(200)
      if (error) throw error
      return data
    }
  })
}

export function usePurchase(id: string | undefined) {
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
          purchase_items (
            id, product_id, qty, cost_at_purchase,
            product:products ( id, name, avg_cost, last_purchase_cost )
          )
          `
        )
        .eq('id', id)
        .single()
      if (error) throw error
      const cashier = (data.cashier as { email: string } | null) ?? null
      const items =
        (data.purchase_items as unknown as PurchaseDetailItem[]) ?? []
      return {
        id: data.id,
        shop_id: data.shop_id,
        total_cost: data.total_cost,
        source: data.source,
        note: data.note,
        purchase_date: data.purchase_date,
        cashier_id: data.cashier_id,
        created_at: data.created_at,
        cashier_email: cashier?.email ?? null,
        items
      }
    }
  })
}

export function useRecordPurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      source?: string
      note?: string
      purchase_date: string
      items: PurchaseItemInput[]
    }) => {
      const { data, error } = await supabase.rpc('record_purchase', {
        p_source: args.source ?? '',
        p_note: args.note ?? '',
        p_purchase_date: args.purchase_date,
        p_items: args.items
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['purchases'] })
      void qc.invalidateQueries({ queryKey: ['products'] })
    }
  })
}
