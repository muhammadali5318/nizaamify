import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData
} from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'
import type { Database } from 'src/types/database'

/**
 * v2.10b — `customers.outstanding_balance` is revoked at the column-grant
 * layer (mig 0094). `useCustomer` / `useCustomers` / `useCreateCustomer`
 * read from `customers_view` (DEFINER, projects outstanding_balance
 * conditionally on view_customer_outstanding) so callers without that
 * permission get NULL instead of a 42501 error.
 */
export type Customer = Omit<
  Database['public']['Tables']['customers']['Row'],
  'outstanding_balance'
> & {
  outstanding_balance: number | null
  has_khata?: boolean | null
}

export type CustomerListRow = {
  id: string
  name: string
  phone: string
  address: string | null
  outstanding: number
  invoice_count: number
  last_activity_at: string
  total_count: number
}

export type RecentCustomer = {
  id: string
  name: string
  phone: string
  address: string | null
  last_activity_at: string
}

// Escape ILIKE special chars and single quotes so user input can be safely
// embedded in a PostgREST `or` filter string. Per spec §3.4.
export function escapeIlike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`).replace(/'/g, "''")
}

// v2.10b — read columns explicitly from customers_view. Selecting '*'
// against the raw `customers` table would error after mig 0094 because
// `outstanding_balance` is no longer granted to authenticated.
const CUSTOMER_VIEW_COLUMNS =
  'id, shop_id, name, phone, address, tier_id, is_active, notes, created_at, updated_at, created_by_user_id, outstanding_balance, has_khata'

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers_view')
        .select(CUSTOMER_VIEW_COLUMNS)
        .order('name')
      if (error) throw error
      return (data ?? []) as unknown as Customer[]
    }
  })
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ['customer', id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('customers_view')
        .select(CUSTOMER_VIEW_COLUMNS)
        .eq('id', id)
        .single()
      if (error) throw error
      return data as unknown as Customer
    }
  })
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: {
      name: string
      phone: string
      address?: string | null
      notes?: string | null
      tier_id?: string | null
    }) => {
      const { data: newId, error } = await supabase.rpc(
        'create_customer_full',
        {
          p_name: values.name,
          p_phone: values.phone,
          p_address: values.address ?? null,
          p_notes: values.notes ?? null,
          p_tier_id: values.tier_id ?? null
        }
      )
      if (error) throw error
      const { data, error: fetchErr } = await supabase
        .from('customers_view')
        .select(CUSTOMER_VIEW_COLUMNS)
        .eq('id', newId as string)
        .single()
      if (fetchErr) throw fetchErr
      return data as unknown as Customer
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['customers'] })
      void qc.invalidateQueries({ queryKey: ['customer-search'] })
      void qc.invalidateQueries({ queryKey: ['customer-recent'] })
      void qc.invalidateQueries({ queryKey: ['customer-list'] })
    }
  })
}

export function useUpdateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    // v2.9.1 D.6 — migrated from direct customers UPDATE to the
    // update_customer DEFINER RPC (migration 0087). Server gates on
    // edit_customer; tier change additionally gates on assign_customer_tier.
    // Writes updated_by_user_id audit column (added in 0087 schema additive).
    mutationFn: async (values: {
      id: string
      name: string
      phone: string
      address?: string | null
      notes?: string | null
      tier_id?: string | null
    }) => {
      const { error } = await supabase.rpc('update_customer', {
        p_id: values.id,
        p_name: values.name,
        p_phone: values.phone,
        p_address: values.address ?? null,
        p_notes: values.notes ?? null,
        p_tier_id: values.tier_id ?? null
      })
      if (error) throw error
      // RPC returns void; callers that expected the updated row must
      // re-read via useCustomer. Invalidation below drives that refetch.
      return values.id
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['customers'] })
      void qc.invalidateQueries({ queryKey: ['customer', vars.id] })
      void qc.invalidateQueries({ queryKey: ['customer-search'] })
      void qc.invalidateQueries({ queryKey: ['customer-recent'] })
      void qc.invalidateQueries({ queryKey: ['customer-list'] })
    }
  })
}

// Counts invoices and ledger entries linked to a customer.
// Previously gated the Delete action; retained because callers may
// still use it for "has activity?" displays. v2.9 sweep removed
// the delete capability — see ADR 2026-05-12-v2-9-0-1-frontend-sweep.
export function useCustomerHistoryCount(id: string | undefined) {
  return useQuery({
    queryKey: ['customer-history', id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return { invoices: 0, ledger: 0 }
      const [{ count: invoices }, { count: ledger }] = await Promise.all([
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', id),
        supabase
          .from('ledger_entries')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', id)
      ])
      return { invoices: invoices ?? 0, ledger: ledger ?? 0 }
    }
  })
}

export function useRecentCustomers(limit = 10) {
  return useQuery({
    queryKey: ['customer-recent', limit],
    queryFn: async (): Promise<RecentCustomer[]> => {
      const { data, error } = await supabase.rpc('recent_customers', {
        p_limit: limit
      })
      if (error) throw error
      return (data ?? []) as RecentCustomer[]
    },
    staleTime: 30_000
  })
}

export function useCustomerSearch(args: {
  query: string
  offset: number
  pageSize?: number
  enabled?: boolean
}) {
  const { query, offset, pageSize = 10, enabled = true } = args
  const trimmed = query.trim()
  const safe = escapeIlike(trimmed)
  return useQuery({
    queryKey: ['customer-search', trimmed, offset, pageSize],
    enabled: enabled && trimmed.length > 0,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone, address')
        .or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`)
        .order('name')
        .range(offset, offset + pageSize - 1)
      if (error) throw error
      return data ?? []
    },
    staleTime: 30_000
  })
}

export function useListCustomers(args: {
  query: string
  page: number
  pageSize?: number
}) {
  const { query, page, pageSize = 25 } = args
  return useQuery({
    queryKey: ['customer-list', query.trim(), page, pageSize],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<{
      rows: CustomerListRow[]
      total: number
    }> => {
      const { data, error } = await supabase.rpc('list_customers', {
        p_query: query.trim(),
        p_limit: pageSize,
        p_offset: page * pageSize
      })
      if (error) throw error
      const rows = (data ?? []) as CustomerListRow[]
      return {
        rows,
        total: rows.length > 0 ? Number(rows[0].total_count) : 0
      }
    }
  })
}
