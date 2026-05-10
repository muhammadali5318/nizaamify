import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'
import type { Database } from 'src/types/database'

export type Supplier = Database['public']['Tables']['suppliers']['Row']

export type SupplierSearchRow = {
  id: string
  name: string
  contact: string | null
  address: string | null
  is_active: boolean
  total_count: number
}

export type RecentSupplier = {
  id: string
  name: string
  contact: string | null
  last_used_at: string | null
}

export function useSupplier(id: string | undefined) {
  return useQuery({
    queryKey: ['supplier', id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    }
  })
}

export function useRecentSuppliers(limit = 10) {
  return useQuery({
    queryKey: ['supplier-recent', limit],
    queryFn: async (): Promise<RecentSupplier[]> => {
      const { data, error } = await supabase.rpc('recent_suppliers', {
        p_limit: limit
      })
      if (error) throw error
      return (data ?? []) as RecentSupplier[]
    },
    staleTime: 30_000
  })
}

export function useSearchSuppliers(args: {
  query: string
  page: number
  pageSize?: number
  enabled?: boolean
}) {
  const { query, page, pageSize = 10, enabled = true } = args
  const trimmed = query.trim()
  return useQuery({
    queryKey: ['supplier-search', trimmed, page, pageSize],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<{
      rows: SupplierSearchRow[]
      total: number
    }> => {
      const { data, error } = await supabase.rpc('search_suppliers', {
        p_query: trimmed,
        p_limit: pageSize,
        p_offset: page * pageSize
      })
      if (error) throw error
      const rows = (data ?? []) as SupplierSearchRow[]
      return {
        rows,
        total: rows.length > 0 ? Number(rows[0].total_count) : 0
      }
    },
    staleTime: 30_000
  })
}

export function useCreateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: {
      name: string
      contact?: string | null
      address?: string | null
      notes?: string | null
    }) => {
      const { data, error } = await supabase.rpc('create_supplier_inline', {
        p_name: values.name,
        p_contact: values.contact ?? undefined,
        p_address: values.address ?? undefined,
        p_notes: values.notes ?? undefined
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['supplier-search'] })
      void qc.invalidateQueries({ queryKey: ['supplier-recent'] })
    }
  })
}

export function useUpdateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: {
      id: string
      name: string
      contact?: string | null
      address?: string | null
      notes?: string | null
    }) => {
      const { id, ...rest } = values
      const { data, error } = await supabase
        .from('suppliers')
        .update({
          name: rest.name,
          contact: rest.contact ?? null,
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
      void qc.invalidateQueries({ queryKey: ['supplier', vars.id] })
      void qc.invalidateQueries({ queryKey: ['supplier-search'] })
      void qc.invalidateQueries({ queryKey: ['supplier-recent'] })
    }
  })
}

export function useArchiveSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('suppliers')
        .update({ is_active: false })
        .eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['supplier-search'] })
      void qc.invalidateQueries({ queryKey: ['supplier-recent'] })
    }
  })
}

export function isDuplicateSupplierError(err: unknown): boolean {
  const e = err as { message?: unknown; code?: unknown }
  const message = typeof e?.message === 'string' ? e.message : ''
  const code = typeof e?.code === 'string' ? e.code : ''
  // Two paths reach here:
  //   - create_supplier_inline RPC raises `duplicate_supplier_name_contact`
  //     (and the legacy `duplicate_supplier_name` pre-v2.3b)
  //   - useUpdateSupplier hits the table directly, so a duplicate surfaces
  //     as a raw PG unique-violation (sqlstate 23505) on the
  //     `uq_suppliers_shop_name_contact` index.
  if (
    message.includes('duplicate_supplier_name_contact') ||
    message.includes('duplicate_supplier_name')
  ) {
    return true
  }
  return code === '23505' && message.includes('uq_suppliers_shop_name')
}
