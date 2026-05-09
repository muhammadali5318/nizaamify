import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'

export type SaleItemInput = {
  product_id: string
  qty: number
  price_at_sale: number
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
    }) => {
      const { data, error } = await supabase.rpc('record_sale', {
        p_customer_id: args.customer_id,
        p_amount_paid: args.amount_paid,
        p_service_charge: args.service_charge,
        p_notes: args.notes,
        p_items: args.items
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
