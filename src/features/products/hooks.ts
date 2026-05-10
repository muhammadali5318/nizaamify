import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'
import type { Database } from 'src/types/database'

export type Product = Database['public']['Tables']['products']['Row']
export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type ProductUpdate = Database['public']['Tables']['products']['Update']

export type ProductSearchRow = {
  id: string
  name: string
  type: string
  description: string | null
  price: number
  avg_cost: number
  last_purchase_cost: number | null
  stock: number
  is_active: boolean
  relevance: number
}

export type SearchProductsArgs = {
  query: string
  page: number
  pageSize: number
  onlyInStock?: boolean
}

export type RecentPurchaseProduct = {
  id: string
  name: string
  type: string
  price: number
  avg_cost: number
  stock: number
  last_used_at: string | null
}

export function useRecentPurchaseProducts(limit = 10) {
  return useQuery({
    queryKey: ['products', 'recent-purchase', limit],
    queryFn: async (): Promise<RecentPurchaseProduct[]> => {
      const { data, error } = await supabase.rpc('recent_purchase_products', {
        p_limit: limit
      })
      if (error) throw error
      return (data ?? []) as RecentPurchaseProduct[]
    },
    staleTime: 30_000
  })
}

export function useSearchProducts(args: SearchProductsArgs) {
  const { query, page, pageSize, onlyInStock = false } = args
  return useQuery({
    queryKey: ['products', 'search', { query, page, pageSize, onlyInStock }],
    queryFn: async () => {
      const offset = page * pageSize
      const [rowsRes, countRes] = await Promise.all([
        supabase.rpc('search_products', {
          p_query: query || undefined,
          p_limit: pageSize,
          p_offset: offset,
          p_only_in_stock: onlyInStock
        }),
        supabase.rpc('search_products_count', {
          p_query: query || undefined,
          p_only_in_stock: onlyInStock
        })
      ])
      if (rowsRes.error) throw rowsRes.error
      if (countRes.error) throw countRes.error
      return {
        rows: (rowsRes.data ?? []) as ProductSearchRow[],
        total: Number(countRes.data ?? 0)
      }
    },
    placeholderData: (prev) => prev
  })
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['product', id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    }
  })
}

export type CreateProductInput = {
  name: string
  type: string
  description: string | null
  price: number
  opening_stock: number
  opening_cost: number
  is_scan_only: boolean
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: CreateProductInput) => {
      const { data, error } = await supabase.rpc(
        'create_product_with_opening_stock',
        {
          p_name: values.name,
          p_type: values.type,
          p_description: values.description ?? undefined,
          p_price: values.price,
          p_opening_stock: values.opening_stock,
          p_opening_cost: values.opening_cost
        }
      )
      if (error) throw error
      const productId = data as string
      // Scan-only is a v2.1 product flag set via direct UPDATE — no RPC for it
      // since the column has no business rules beyond shop ownership (RLS).
      if (values.is_scan_only) {
        const { error: updErr } = await supabase
          .from('products')
          .update({ is_scan_only: true })
          .eq('id', productId)
        if (updErr) throw updErr
      }
      return productId
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
    }
  })
}

export type UpdateProductInput = {
  id: string
  name: string
  type: string
  description: string | null
  price: number
  is_active: boolean
  is_scan_only: boolean
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: UpdateProductInput) => {
      const { id, ...rest } = values
      const { error } = await supabase
        .from('products')
        .update({
          name: rest.name,
          type: rest.type,
          description: rest.description,
          price: rest.price,
          is_active: rest.is_active,
          is_scan_only: rest.is_scan_only
        } as ProductUpdate)
        .eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: ['product'] })
    }
  })
}

export function useArchiveProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('products')
        .update({ is_active: isActive })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: ['product'] })
    }
  })
}

// Lightweight list used by stock-in flows that just need (id, name, type).
// /products and /pos use useSearchProducts (paginated, fuzzy) instead.
export function useProducts(opts?: { includeArchived?: boolean }) {
  return useQuery({
    queryKey: ['products', { includeArchived: !!opts?.includeArchived }],
    queryFn: async () => {
      let q = supabase.from('products').select('*').order('name')
      if (!opts?.includeArchived) q = q.eq('is_active', true)
      const { data, error } = await q
      if (error) throw error
      return data
    }
  })
}

export function useExistingProductTypes() {
  return useQuery({
    queryKey: ['products', 'types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('type')
        .eq('is_active', true)
      if (error) throw error
      const set = new Set<string>()
      for (const row of data ?? []) {
        if (row.type) set.add(row.type)
      }
      return Array.from(set).sort()
    }
  })
}
