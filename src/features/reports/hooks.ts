import { useQuery } from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'

export function useDailySalesLast7() {
  return useQuery({
    queryKey: ['reports', 'daily_sales_7'],
    queryFn: async () => {
      const since = new Date()
      since.setUTCDate(since.getUTCDate() - 6)
      since.setUTCHours(0, 0, 0, 0)
      const { data, error } = await supabase
        .from('invoices')
        .select('total, created_at')
        .gte('created_at', since.toISOString())
      if (error) throw error
      const buckets = new Map<string, number>()
      for (let i = 0; i < 7; i++) {
        const d = new Date(since)
        d.setUTCDate(d.getUTCDate() + i)
        buckets.set(d.toISOString().slice(0, 10), 0)
      }
      for (const row of data ?? []) {
        const key = new Date(row.created_at).toISOString().slice(0, 10)
        buckets.set(key, (buckets.get(key) ?? 0) + Number(row.total))
      }
      return Array.from(buckets.entries()).map(([date, total]) => ({
        date,
        total
      }))
    }
  })
}

export function useMonthlySummaryLast6() {
  return useQuery({
    queryKey: ['reports', 'monthly_summary_6'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_summary')
        .select('*')
        .order('month', { ascending: false })
        .limit(6)
      if (error) throw error
      return data ?? []
    }
  })
}

export function useExpenseBreakdownThisMonth() {
  return useQuery({
    queryKey: ['reports', 'expense_breakdown_month'],
    queryFn: async () => {
      const now = new Date()
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
      )
        .toISOString()
        .slice(0, 10)
      const end = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
      )
        .toISOString()
        .slice(0, 10)
      const { data, error } = await supabase
        .from('expenses')
        .select('category, amount')
        .gte('expense_date', start)
        .lt('expense_date', end)
      if (error) throw error
      const totals = new Map<string, number>()
      for (const r of data ?? []) {
        totals.set(r.category, (totals.get(r.category) ?? 0) + Number(r.amount))
      }
      return Array.from(totals.entries())
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)
    }
  })
}
