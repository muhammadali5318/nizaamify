import { useQuery } from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'

function firstOfMonth(date = new Date()) {
  const y = date.getUTCFullYear()
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0')
  return `${y}-${m}-01`
}

export function useTodaySales() {
  return useQuery({
    queryKey: ['daily_sales_today'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_sales_today')
        .select('*')
        .maybeSingle()
      if (error) throw error
      return data
    }
  })
}

export function useMonthlySummary(month: string = firstOfMonth()) {
  return useQuery({
    queryKey: ['monthly_summary', month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_summary')
        .select('*')
        .eq('month', month)
        .maybeSingle()
      if (error) throw error
      return data
    }
  })
}

export function useTotalOutstanding() {
  return useQuery({
    queryKey: ['outstanding-total'],
    queryFn: async () => {
      // v2.6c: aggregate happens in Postgres (total_outstanding view) so
      // no JS Number arithmetic runs on a money sum. Returns numeric(12,2).
      const { data, error } = await supabase
        .from('total_outstanding')
        .select('total')
        .maybeSingle()
      if (error) throw error
      return Number(data?.total ?? 0)
    }
  })
}
