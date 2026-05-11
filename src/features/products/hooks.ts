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
      // v2.6: stock/price/cost/avg_cost/last_purchase_cost moved to the default
      // variant. We fetch the product row + its default variant in one round
      // trip and overlay variant fields onto the top-level Product shape so
      // downstream consumers (detail page, edit modal) don't change.
      const { data, error } = await supabase
        .from('products')
        .select(
          'id, shop_id, name, type, category_id, description, is_active, is_scan_only, base_unit_id, created_at, updated_at, default_variant:product_variants!inner(id, sku, stock, price, cost, avg_cost, last_purchase_cost)'
        )
        .eq('id', id)
        .eq('product_variants.is_default', true)
        .eq('product_variants.is_active', true)
        .single()
      if (error) throw error
      const variant = Array.isArray(data.default_variant)
        ? data.default_variant[0]
        : data.default_variant
      const merged = {
        ...data,
        default_variant_id: variant?.id ?? null,
        sku: variant?.sku ?? null,
        stock: variant?.stock ?? 0,
        price: variant?.price ?? null,
        cost: variant?.cost ?? null,
        avg_cost: variant?.avg_cost ?? 0,
        last_purchase_cost: variant?.last_purchase_cost ?? null
      } as Product & {
        default_variant_id: string | null
        sku: string | null
      }
      // Remove the relational sub-object — downstream code reads flat fields.
      delete (merged as { default_variant?: unknown }).default_variant
      return merged
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
      // v2.6: RPC returns table(product_id, variant_id); is_scan_only is a
      // first-class parameter now, so the post-insert UPDATE is gone.
      const { data, error } = await supabase.rpc(
        'create_product_with_opening_stock',
        {
          p_name: values.name,
          p_category_id: values.category_id,
          p_description: values.description ?? undefined,
          p_price: values.price,
          p_opening_stock: values.opening_stock,
          p_opening_cost:
            values.opening_stock > 0 ? values.opening_cost : undefined,
          p_is_scan_only: values.is_scan_only
        }
      )
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      return (row as { product_id: string }).product_id
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

export type CreateProductWithVariantsInput = {
  name: string
  category_id: string
  default_price: number
  is_scan_only: boolean
  attribute_ids: string[]
  variants: {
    attribute_value_ids: string[]
    sku?: string
    price?: number
    opening_stock?: number
    opening_cost?: number
  }[]
  description?: string | null
}

export function useCreateProductWithVariants() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateProductWithVariantsInput) => {
      const { data, error } = await supabase.rpc(
        'create_product_with_variants',
        {
          p_name: input.name,
          p_category_id: input.category_id,
          p_default_price: input.default_price,
          p_is_scan_only: input.is_scan_only,
          p_attribute_ids: input.attribute_ids,
          p_variants: input.variants as unknown as never,
          p_description: input.description ?? undefined
        }
      )
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      return row as { product_id: string; variant_ids: string[] }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: ['variant_attributes'] })
    }
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: UpdateProductInput) => {
      const { id, ...rest } = values
      // v2.6: products.price is deprecated — variant.price is the source of
      // truth. We update both: the products row (name/category/description/
      // is_active/is_scan_only) AND the default variant (price). Writing
      // products.price too is harmless and keeps the legacy column stable
      // until a future cleanup migration drops it.
      const { data: cat, error: catErr } = await supabase
        .from('product_categories')
        .select('name')
        .eq('id', rest.category_id)
        .single()
      if (catErr) throw catErr

      const { error: prodErr } = await supabase
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
      if (prodErr) throw prodErr

      // Variant price is the source of truth post-v2.6.
      const { error: variantErr } = await supabase
        .from('product_variants')
        .update({ price: rest.price })
        .eq('product_id', id)
        .eq('is_default', true)
        .eq('is_active', true)
      if (variantErr) throw variantErr

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
      // v2.6: keep the default variant's is_active in sync with the product's
      // — the compat view joins on v.is_active, so a "live" variant under an
      // "archived" product would leak into reads.
      const { error: variantErr } = await supabase
        .from('product_variants')
        .update({ is_active: isActive })
        .eq('product_id', id)
        .eq('is_default', true)
      if (variantErr) throw variantErr
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
