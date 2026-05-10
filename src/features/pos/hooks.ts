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
      /** v2.2: when set, takes precedence over the customer's tier discount. */
      tier_override_type?: 'percent' | 'fixed' | null
      tier_override_value?: number | null
    }) => {
      const { data, error } = await supabase.rpc('record_sale', {
        p_customer_id: args.customer_id,
        p_amount_paid: args.amount_paid,
        p_service_charge: args.service_charge,
        p_notes: args.notes,
        p_items: args.items as unknown as never,
        p_tier_override_type: args.tier_override_type ?? undefined,
        p_tier_override_value: args.tier_override_value ?? undefined
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
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
