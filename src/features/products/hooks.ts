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
  category_id: string
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
  categoryId?: string | null
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
  const { query, page, pageSize, onlyInStock = false, categoryId = null } = args
  return useQuery({
    queryKey: [
      'products',
      'search',
      { query, page, pageSize, onlyInStock, categoryId }
    ],
    queryFn: async () => {
      const offset = page * pageSize
      const [rowsRes, countRes] = await Promise.all([
        supabase.rpc('search_products', {
          p_query: query || undefined,
          p_limit: pageSize,
          p_offset: offset,
          p_only_in_stock: onlyInStock,
          p_category_id: categoryId ?? undefined
        }),
        supabase.rpc('search_products_count', {
          p_query: query || undefined,
          p_only_in_stock: onlyInStock,
          p_category_id: categoryId ?? undefined
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

export type ProductActivityRow = {
  kind: 'stock_in' | 'sale'
  at: string
  qty: number
  party: string | null // supplier or customer name; null = walk-in / no supplier
}

const ACTIVITY_LIMIT = 10

/**
 * Last 10 stock-in / sale lines for a product, newest first. Used by the
 * /products/:id detail page and the POS drawer (§1.2 / §1.3 of v2.5 spec).
 * Two simple `from(...)` queries + an in-JS merge keep this honest — no
 * server-side RPC needed for ten rows.
 */
export function useProductActivity(productId: string | undefined) {
  return useQuery({
    queryKey: ['product', 'activity', productId],
    enabled: !!productId,
    queryFn: async (): Promise<ProductActivityRow[]> => {
      if (!productId) return []
      const [piRes, siRes] = await Promise.all([
        supabase
          .from('purchase_items')
          .select(
            'qty, qty_in_base, purchase:purchases(purchase_date, supplier:suppliers(name))'
          )
          .eq('product_id', productId)
          .order('purchase(purchase_date)', { ascending: false })
          .limit(ACTIVITY_LIMIT),
        supabase
          .from('sale_items')
          .select('qty, invoice:invoices(created_at, customer:customers(name))')
          .eq('product_id', productId)
          .order('invoice(created_at)', { ascending: false })
          .limit(ACTIVITY_LIMIT)
      ])
      if (piRes.error) throw piRes.error
      if (siRes.error) throw siRes.error

      type PurchaseRow = {
        qty: number
        qty_in_base: number | null
        purchase: {
          purchase_date: string
          supplier: { name: string } | null
        } | null
      }
      type SaleRow = {
        qty: number
        invoice: {
          created_at: string
          customer: { name: string } | null
        } | null
      }

      const stockIns: ProductActivityRow[] = (piRes.data as PurchaseRow[])
        .filter((r) => r.purchase)
        .map((r) => ({
          kind: 'stock_in' as const,
          at: r.purchase!.purchase_date,
          qty: Number(r.qty_in_base ?? r.qty),
          party: r.purchase!.supplier?.name ?? null
        }))

      const sales: ProductActivityRow[] = (siRes.data as SaleRow[])
        .filter((r) => r.invoice)
        .map((r) => ({
          kind: 'sale' as const,
          at: r.invoice!.created_at,
          qty: Number(r.qty),
          party: r.invoice!.customer?.name ?? null
        }))

      return [...stockIns, ...sales]
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, ACTIVITY_LIMIT)
    },
    staleTime: 30_000
  })
}

export type CreateProductInput = {
  name: string
  category_id: string
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
          p_category_id: values.category_id,
          p_description: values.description ?? undefined,
          p_price: values.price,
          p_opening_stock: values.opening_stock,
          p_opening_cost: values.opening_cost
        }
      )
      if (error) throw error
      const productId = data as string
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
      void qc.invalidateQueries({ queryKey: ['categories'] })
    }
  })
}

export type UpdateProductInput = {
  id: string
  name: string
  category_id: string
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
      // Snapshot the category name into products.type for back-compat with any
      // legacy read path until the column is dropped in a future cleanup.
      const { data: cat, error: catErr } = await supabase
        .from('product_categories')
        .select('name')
        .eq('id', rest.category_id)
        .single()
      if (catErr) throw catErr
      const { error } = await supabase
        .from('products')
        .update({
          name: rest.name,
          type: cat.name,
          category_id: rest.category_id,
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
      void qc.invalidateQueries({ queryKey: ['categories'] })
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
