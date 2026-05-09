import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'

export type KhataStatus = 'open' | 'closed' | 'all'

// Legacy hook kept for the reports/dashboard surfaces that still read the
// shop-wide outstanding view. New khata UI uses useSearchKhataCustomers.
export function useOutstanding(opts?: { onlyOutstanding?: boolean }) {
  return useQuery({
    queryKey: ['outstanding', { onlyOutstanding: !!opts?.onlyOutstanding }],
    queryFn: async () => {
      let q = supabase
        .from('customer_outstanding')
        .select('*')
        .order('outstanding', { ascending: false })
      if (opts?.onlyOutstanding) {
        q = q.gt('outstanding', 0)
      }
      const { data, error } = await q
      if (error) throw error
      return data
    }
  })
}

export type KhataListRow = {
  id: string
  name: string
  phone: string
  address: string | null
  outstanding_balance: number
  last_activity_at: string | null
  entry_count: number
}

export type LedgerEntryView = {
  id: string
  shop_id: string
  customer_id: string
  invoice_id: string | null
  amount: number
  type: 'debit' | 'credit'
  occurred_at: string
  created_at: string
  notes: string | null
  reverses_entry_id: string | null
  reversed_by_entry_id: string | null
  reversed_at: string | null
  invoice_notes: string | null
  invoice_total: number | null
  invoice_amount_paid: number | null
  invoice_payment_type: string | null
  products_summary: string | null
  items_count: number | null
}

export function useSearchKhataCustomers(args: {
  query: string
  status: KhataStatus
  page: number
  pageSize?: number
}) {
  const { query, status, page, pageSize = 50 } = args
  return useQuery({
    queryKey: ['khata-search', query.trim(), status, page, pageSize],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const offset = page * pageSize
      const [rowsRes, countRes] = await Promise.all([
        supabase.rpc('search_khata_customers', {
          p_query: query.trim() || undefined,
          p_status: status,
          p_limit: pageSize,
          p_offset: offset
        }),
        supabase.rpc('search_khata_customers_count', {
          p_query: query.trim() || undefined,
          p_status: status
        })
      ])
      if (rowsRes.error) throw rowsRes.error
      if (countRes.error) throw countRes.error
      return {
        rows: (rowsRes.data ?? []) as KhataListRow[],
        total: Number(countRes.data ?? 0)
      }
    }
  })
}

export function useLedgerEntries(customerId: string | undefined) {
  return useQuery({
    queryKey: ['ledger', customerId],
    enabled: !!customerId,
    queryFn: async (): Promise<LedgerEntryView[]> => {
      if (!customerId) return []
      const { data, error } = await supabase
        .from('ledger_entries_view')
        .select('*')
        .eq('customer_id', customerId)
        .order('occurred_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => ({
        ...(r as unknown as LedgerEntryView),
        type: (r.type ?? 'debit') as 'debit' | 'credit'
      }))
    }
  })
}

export type ReceivePaymentArgs = {
  customer_id: string
  amount: number
  notes: string | null
}

export function useReceivePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: ReceivePaymentArgs) => {
      const { data, error } = await supabase.rpc('receive_payment', {
        p_customer_id: args.customer_id,
        p_amount: args.amount,
        p_notes: args.notes ?? undefined
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ledger'] })
      void qc.invalidateQueries({ queryKey: ['outstanding'] })
      void qc.invalidateQueries({ queryKey: ['khata-search'] })
      void qc.invalidateQueries({ queryKey: ['customer'] })
      void qc.invalidateQueries({ queryKey: ['customer-list'] })
    }
  })
}

export function useReverseLedgerEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { entry_id: string; notes?: string | null }) => {
      const { data, error } = await supabase.rpc('reverse_ledger_entry', {
        p_entry_id: args.entry_id,
        p_notes: args.notes ?? undefined
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ledger'] })
      void qc.invalidateQueries({ queryKey: ['outstanding'] })
      void qc.invalidateQueries({ queryKey: ['khata-search'] })
      void qc.invalidateQueries({ queryKey: ['customer'] })
      void qc.invalidateQueries({ queryKey: ['customer-list'] })
    }
  })
}

// Map RPC error messages from receive_payment to i18n keys.
// In the traditional khata model only customer-level errors exist —
// invoice-linked errors were dropped with the v1.6a simplification.
export type ReceivePaymentError =
  | { kind: 'overpayment_customer'; max: number }
  | { kind: 'amount_must_be_positive' }
  | { kind: 'customer_not_in_shop' }
  | { kind: 'unknown'; message: string }

export function classifyReceivePaymentError(err: unknown): ReceivePaymentError {
  const message =
    typeof (err as { message?: unknown })?.message === 'string'
      ? ((err as { message: string }).message as string)
      : ''

  const overCust = message.match(/overpayment_customer\s+max=([\d.]+)/)
  if (overCust)
    return { kind: 'overpayment_customer', max: Number(overCust[1]) }
  if (message.includes('amount_must_be_positive'))
    return { kind: 'amount_must_be_positive' }
  if (message.includes('customer_not_in_shop'))
    return { kind: 'customer_not_in_shop' }
  return { kind: 'unknown', message }
}

export type ReverseError =
  | { kind: 'cannot_reverse_a_reversal' }
  | { kind: 'cannot_reverse_invoice_tied_debit' }
  | { kind: 'entry_already_reversed' }
  | { kind: 'entry_not_in_shop' }
  | { kind: 'unknown'; message: string }

export function classifyReverseError(err: unknown): ReverseError {
  const message =
    typeof (err as { message?: unknown })?.message === 'string'
      ? ((err as { message: string }).message as string)
      : ''
  if (message.includes('cannot_reverse_a_reversal'))
    return { kind: 'cannot_reverse_a_reversal' }
  if (message.includes('cannot_reverse_invoice_tied_debit'))
    return { kind: 'cannot_reverse_invoice_tied_debit' }
  if (message.includes('entry_already_reversed'))
    return { kind: 'entry_already_reversed' }
  if (message.includes('entry_not_in_shop'))
    return { kind: 'entry_not_in_shop' }
  return { kind: 'unknown', message }
}
