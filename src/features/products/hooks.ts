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
  // v2.7 additions — null when product is single-variant
  has_variants: boolean
  variant_count: number
  min_price: number | null
  max_price: number | null
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
      // v2.7: include has_variants. For has_variants=true the inner-join on
      // default variant returns zero rows, so we use a !left join — the
      // variant fields then come back null and the detail page branches on
      // has_variants to render the variants table instead.
      const { data, error } = await supabase
        .from('products')
        .select(
          'id, shop_id, name, type, category_id, description, is_active, is_scan_only, base_unit_id, has_variants, created_at, updated_at, default_variant:product_variants(id, sku, stock, price, cost, avg_cost, last_purchase_cost, is_default, is_active)'
        )
        .eq('id', id)
        .single()
      if (error) throw error
      // Pick the is_default + is_active variant from the array
      const variantsArr = Array.isArray(data.default_variant)
        ? data.default_variant
        : data.default_variant
          ? [data.default_variant]
          : []
      const variant =
        variantsArr.find(
          (v) => v.is_default === true && v.is_active === true
        ) ?? null
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

/**
 * Variants for a multi-variant product, joined to their attribute combo and
 * variant_label via the product_variant_full view (v2.7 §4.5).
 */
export type ProductVariantRow = {
  variant_id: string
  sku: string | null
  stock: number
  price: number | null
  avg_cost: number
  last_purchase_cost: number | null
  variant_is_active: boolean
  attributes: Record<string, string>
  variant_label: string | null
  is_default: boolean
}

export function useProductVariants(productId: string | undefined) {
  return useQuery({
    queryKey: ['product', 'variants', productId],
    enabled: !!productId,
    queryFn: async (): Promise<ProductVariantRow[]> => {
      if (!productId) return []
      const { data, error } = await supabase
        .from('product_variant_full')
        .select(
          'variant_id, sku, stock, price, avg_cost, last_purchase_cost, variant_is_active, attributes, variant_label, is_default'
        )
        .eq('product_id', productId)
        .order('variant_label', { ascending: true })
      if (error) throw error
      return (data ?? []).map((row) => ({
        variant_id: row.variant_id ?? '',
        sku: row.sku,
        stock: row.stock ?? 0,
        price: row.price === null ? null : Number(row.price),
        avg_cost: Number(row.avg_cost ?? 0),
        last_purchase_cost:
          row.last_purchase_cost === null
            ? null
            : Number(row.last_purchase_cost),
        variant_is_active: row.variant_is_active ?? false,
        attributes: (row.attributes ?? {}) as Record<string, string>,
        variant_label: row.variant_label,
        is_default: row.is_default ?? false
      }))
    },
    staleTime: 30_000
  })
}

export function useUpdateVariantInline() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      variant_id: string
      sku?: string | null
      price?: number | null
      is_active?: boolean
    }) => {
      const patch: Record<string, unknown> = {}
      if (input.sku !== undefined) patch.sku = input.sku
      if (input.price !== undefined) patch.price = input.price
      if (input.is_active !== undefined) patch.is_active = input.is_active
      const { error } = await supabase
        .from('product_variants')
        .update(patch)
        .eq('id', input.variant_id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['product'] })
      void qc.invalidateQueries({ queryKey: ['products'] })
    }
  })
}

/**
 * Returns the ordered list of attribute ids the product's existing variants
 * are composed of (ordered by attribute display_order). Used by AddVariantDialog
 * so a new variant can show one value picker per existing attribute.
 */
export function useProductAttributeIds(productId: string | undefined) {
  return useQuery({
    queryKey: ['product', 'attribute_ids', productId],
    enabled: !!productId,
    queryFn: async (): Promise<string[]> => {
      if (!productId) return []
      // Pick any variant of the product; read its attribute_value_ids; join to
      // variant_attribute_values → variant_attributes to get attribute ids.
      const { data: oneVariant, error: vErr } = await supabase
        .from('product_variants')
        .select('id')
        .eq('product_id', productId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      if (vErr) throw vErr
      if (!oneVariant) return []

      const { data, error } = await supabase
        .from('product_variant_attribute_values')
        .select(
          'attribute_value_id, value:variant_attribute_values!inner(attribute_id, attribute:variant_attributes!inner(id, display_order, name))'
        )
        .eq('variant_id', oneVariant.id)
      if (error) throw error
      type Row = {
        attribute_value_id: string
        value: {
          attribute_id: string
          attribute: { id: string; display_order: number; name: string }
        } | null
      }
      const attrs = (data as unknown as Row[])
        .map((r) => r.value?.attribute)
        .filter(
          (a): a is { id: string; display_order: number; name: string } => !!a
        )
      // Dedupe + order by display_order then name
      const seen = new Set<string>()
      attrs.sort(
        (a, b) =>
          a.display_order - b.display_order || a.name.localeCompare(b.name)
      )
      return attrs
        .filter((a) => {
          if (seen.has(a.id)) return false
          seen.add(a.id)
          return true
        })
        .map((a) => a.id)
    },
    staleTime: 30_000
  })
}

export function useAddVariantToProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      product_id: string
      attribute_value_ids: string[]
      sku?: string | null
      price?: number | null
      opening_stock?: number
      opening_cost?: number | null
    }) => {
      const { data, error } = await supabase.rpc('add_variant_to_product', {
        p_product_id: input.product_id,
        p_attribute_value_ids: input.attribute_value_ids,
        p_sku: input.sku ?? undefined,
        p_price: input.price ?? undefined,
        p_opening_stock: input.opening_stock ?? 0,
        p_opening_cost: input.opening_cost ?? undefined
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['product'] })
      void qc.invalidateQueries({ queryKey: ['products'] })
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
