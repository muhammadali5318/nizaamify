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
    // v2.9.1 D.7 — migrated to upsert_monthly_target RPC (migration 0075).
    // Server resolves shop_id from active-shop header + writes
    // updated_by_user_id; gates on manage_monthly_targets permission.
    mutationFn: async (args: {
      month: string
      target_sale: number
      target_gross_profit: number
      target_net_profit: number
    }) => {
      const { error } = await supabase.rpc('upsert_monthly_target', {
        p_month: args.month,
        p_target_sale: args.target_sale,
        p_target_gross_profit: args.target_gross_profit,
        p_target_net_profit: args.target_net_profit
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['target'] })
    }
  })
}

export const currentMonthISO = firstOfMonth
