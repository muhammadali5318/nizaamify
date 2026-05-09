import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'
import type { Database } from 'src/types/database'

export type Expense = Database['public']['Tables']['expenses']['Row']

export const EXPENSE_CATEGORIES = [
  'rent',
  'electricity',
  'internet',
  'salary',
  'fuel',
  'other'
] as const

export function useExpenses(opts?: { month?: string }) {
  return useQuery({
    queryKey: ['expenses', opts?.month ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false })
        .limit(500)
      if (opts?.month) {
        // month = YYYY-MM
        const [y, m] = opts.month.split('-').map(Number)
        const start = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10)
        const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)
        q = q.gte('expense_date', start).lt('expense_date', end)
      }
      const { data, error } = await q
      if (error) throw error
      return data
    }
  })
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: {
      category: string
      amount: number
      expense_date: string
      note: string | null
    }) => {
      const { data: shop, error: shopErr } = await supabase
        .from('shops')
        .select('id')
        .single()
      if (shopErr) throw shopErr
      const {
        data: { user }
      } = await supabase.auth.getUser()
      if (!user) throw new Error('not authenticated')
      const { error } = await supabase.from('expenses').insert({
        shop_id: shop.id,
        category: args.category,
        amount: args.amount,
        expense_date: args.expense_date,
        note: args.note,
        created_by: user.id
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expenses'] })
      void qc.invalidateQueries({ queryKey: ['monthly_summary'] })
    }
  })
}
