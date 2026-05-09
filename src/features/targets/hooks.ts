import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'

export type MonthlyTarget = {
  id: string
  shop_id: string
  month: string
  target_sale: number
  target_gross_profit: number
  target_net_profit: number
}

function firstOfMonth(date = new Date()) {
  const y = date.getUTCFullYear()
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0')
  return `${y}-${m}-01`
}

export function useTargetForMonth(month: string = firstOfMonth()) {
  return useQuery({
    queryKey: ['target', month],
    queryFn: async (): Promise<MonthlyTarget | null> => {
      const { data, error } = await supabase
        .from('monthly_targets')
        .select('*')
        .eq('month', month)
        .maybeSingle()
      if (error) throw error
      return data as MonthlyTarget | null
    }
  })
}

export function useUpsertTarget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      month: string
      target_sale: number
      target_gross_profit: number
      target_net_profit: number
    }) => {
      const { data: shop, error: shopErr } = await supabase
        .from('shops')
        .select('id')
        .single()
      if (shopErr) throw shopErr
      const { error } = await supabase.from('monthly_targets').upsert(
        {
          shop_id: shop.id,
          month: args.month,
          target_sale: args.target_sale,
          target_gross_profit: args.target_gross_profit,
          target_net_profit: args.target_net_profit,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'shop_id,month' }
      )
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['target'] })
    }
  })
}

export const currentMonthISO = firstOfMonth
