import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData
} from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'
import type { Database } from 'src/types/database'

export type Customer = Database['public']['Tables']['customers']['Row']

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

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name')
      if (error) throw error
      return data
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
        .from('customers')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
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
    }) => {
      const { data: shop, error: shopErr } = await supabase
        .from('shops')
        .select('id')
        .single()
      if (shopErr) throw shopErr
      const { data, error } = await supabase
        .from('customers')
        .insert({
          name: values.name,
          phone: values.phone,
          address: values.address ?? null,
          notes: values.notes ?? null,
          shop_id: shop.id
        })
        .select('*')
        .single()
      if (error) throw error
      return data
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
    mutationFn: async (values: {
      id: string
      name: string
      phone: string
      address?: string | null
      notes?: string | null
    }) => {
      const { id, ...rest } = values
      const { data, error } = await supabase
        .from('customers')
        .update({
          name: rest.name,
          phone: rest.phone,
          address: rest.address ?? null,
          notes: rest.notes ?? null
        })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return data
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

export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('customers').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['customers'] })
      void qc.invalidateQueries({ queryKey: ['customer-search'] })
      void qc.invalidateQueries({ queryKey: ['customer-recent'] })
      void qc.invalidateQueries({ queryKey: ['customer-list'] })
    }
  })
}

// Counts invoices and ledger entries linked to a customer.
// Used to gate the Delete action on customer screens.
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
