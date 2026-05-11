import { useQuery } from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'

/**
 * v2.6c: server-side bucket. Reads from public.daily_sales_7 view which
 * aggregates invoice_financials.revenue per day for the current shop over
 * the last 7 days. The view returns one row per day even if there were no
 * sales (total = 0), so the chart x-axis is always 7 buckets wide.
 * Frontend just renders the rows — no JS money arithmetic.
 */
export function useDailySalesLast7() {
  return useQuery({
    queryKey: ['reports', 'daily_sales_7'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_sales_7')
        .select('day, total_sales')
        .order('day', { ascending: true })
      if (error) throw error
      return (data ?? []).map((r) => ({
        date: r.day as string,
        total: Number(r.total_sales)
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

/**
 * v2.6c: server-side aggregate. Reads from public.expenses_by_category_mtd
 * which groups expenses by category for the current shop, month-to-date.
 * No JS bucketing — the SUM happens in Postgres.
 */
export function useExpenseBreakdownThisMonth() {
  return useQuery({
    queryKey: ['reports', 'expense_breakdown_month'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses_by_category_mtd')
        .select('category, total_amount')
        .order('total_amount', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => ({
        category: r.category,
        amount: Number(r.total_amount)
      }))
    }
  })
}
