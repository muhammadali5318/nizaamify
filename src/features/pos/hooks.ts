import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'

export type SaleItemInput = {
  product_id: string
  qty: number
  price_at_sale: number
  /** v2.2 per-line discount. Both null = no discount on this line. */
  line_discount_type?: 'percent' | 'fixed' | null
  line_discount_value?: number | null
}

export function useRecordSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      customer_id: string | null
      amount_paid: number
      service_charge: number
      notes: string | null
      items: SaleItemInput[]
      /** v2.3: manual sale-time discount (% or fixed). Customer tier no longer
       * auto-discounts. Cleared by caller after successful submit. */
      sale_discount_type?: 'percent' | 'fixed' | null
      sale_discount_value?: number | null
      /** v2.8.4: cashier's explicit "yes, I confirm selling from expired
       * stock" signal. Only meaningful in warn-policy mode. */
      confirm_expired_sale?: boolean
    }) => {
      const { data, error } = await supabase.rpc('record_sale', {
        p_customer_id: args.customer_id,
        p_amount_paid: args.amount_paid,
        p_service_charge: args.service_charge,
        p_notes: args.notes,
        p_items: args.items as unknown as never,
        p_sale_discount_type: args.sale_discount_type ?? undefined,
        p_sale_discount_value: args.sale_discount_value ?? undefined,
        p_confirm_expired_sale: args.confirm_expired_sale ?? false
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      // v2.8.5: single-product detail page (`useProduct(id)`) and the v2.8.5
      // POS batch picker (`useActiveBatchesForVariant`) cache by these keys.
      // Without explicit invalidation the picker showed pre-sale
      // qty_remaining on the next add-to-cart cycle until a hard reload.
      void qc.invalidateQueries({ queryKey: ['product'] })
      void qc.invalidateQueries({ queryKey: ['batches'] })
      // v2.8 alert widgets read from the same underlying batches; a sale
      // that empties a batch will flip is_active=false via the
      // auto-deactivate trigger, which can shift alert-widget counts.
      void qc.invalidateQueries({ queryKey: ['alerts'] })
      void qc.invalidateQueries({ queryKey: ['invoices'] })
      void qc.invalidateQueries({ queryKey: ['ledger'] })
      void qc.invalidateQueries({ queryKey: ['ledger-invoice'] })
      void qc.invalidateQueries({ queryKey: ['outstanding'] })
      void qc.invalidateQueries({ queryKey: ['sales'] })
      void qc.invalidateQueries({ queryKey: ['customer-recent'] })
      void qc.invalidateQueries({ queryKey: ['customer-list'] })
      // v1.6: credit/partial sales bump customer.outstanding_balance via trigger;
      // these keys back the khata list and the customer detail page.
      void qc.invalidateQueries({ queryKey: ['customer'] })
      void qc.invalidateQueries({ queryKey: ['khata-search'] })
      void qc.invalidateQueries({ queryKey: ['customer-open-invoices'] })
    }
  })
}

/** v2.8.4: ask the server which cart lines will draw from expired batches
 * and what each variant's effective policy is. Renders dialogs before
 * record_sale runs so cashiers get a confirm/block decision up-front, not
 * an error round-trip. */
export type PreflightExpiredSaleRow = {
  variant_id: string
  would_draw_expired: boolean
  expired_batch_ids: string[]
  policy: 'block' | 'warn' | 'allow'
}

export type PreflightExpiredSaleInput = {
  items: Array<{
    variant_id?: string
    product_id?: string
    qty: number
    batch_id?: string
  }>
}

export function usePreflightExpiredSaleCheck() {
  return useMutation({
    mutationFn: async (
      input: PreflightExpiredSaleInput
    ): Promise<PreflightExpiredSaleRow[]> => {
      const { data, error } = await supabase.rpc(
        'preflight_expired_sale_check',
        {
          p_items: input.items as unknown as never
        }
      )
      if (error) throw error
      const rows = (data ?? []) as Array<{
        variant_id: string
        would_draw_expired: boolean
        expired_batch_ids: string[] | null
        policy: 'block' | 'warn' | 'allow'
      }>
      return rows.map((r) => ({
        variant_id: r.variant_id,
        would_draw_expired: r.would_draw_expired,
        expired_batch_ids: r.expired_batch_ids ?? [],
        policy: r.policy
      }))
    }
  })
}
