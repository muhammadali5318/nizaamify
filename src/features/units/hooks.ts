import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'
import { useShop } from 'src/features/auth/hooks'

export type UnitOfMeasure = {
  id: string
  code: string
  name: string
  is_active: boolean
}

export type ProductPack = {
  id: string
  product_id: string
  unit_id: string
  unit_code: string
  unit_name: string
  base_qty: number
  is_default_purchase: boolean
  is_active: boolean
}

export function useUnitsOfMeasure() {
  const { data: shop } = useShop()
  const shopId = shop?.id
  return useQuery({
    queryKey: ['units_of_measure', shopId],
    enabled: !!shopId,
    queryFn: async (): Promise<UnitOfMeasure[]> => {
      const { data, error } = await supabase
        .from('units_of_measure')
        .select('id, code, name, is_active')
        .eq('is_active', true)
        .order('code')
      if (error) throw error
      return (data ?? []) as UnitOfMeasure[]
    }
  })
}

export function useProductPacks(productId: string | undefined) {
  return useQuery({
    queryKey: ['product_packs', productId],
    enabled: !!productId,
    queryFn: async (): Promise<ProductPack[]> => {
      if (!productId) return []
      const { data, error } = await supabase
        .from('product_packs')
        .select(
          'id, product_id, unit_id, base_qty, is_default_purchase, is_active, units_of_measure:unit_id (code, name)'
        )
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('base_qty')
      if (error) throw error
      return (
        (data ?? []) as Array<{
          id: string
          product_id: string
          unit_id: string
          base_qty: number
          is_default_purchase: boolean
          is_active: boolean
          units_of_measure: { code: string; name: string } | null
        }>
      ).map((row) => ({
        id: row.id,
        product_id: row.product_id,
        unit_id: row.unit_id,
        unit_code: row.units_of_measure?.code ?? '',
        unit_name: row.units_of_measure?.name ?? '',
        base_qty: row.base_qty,
        is_default_purchase: row.is_default_purchase,
        is_active: row.is_active
      }))
    }
  })
}

/**
 * Inline pack creation from the stock-in form (spec §4.1, §5.1). The RPC
 * resolves or creates the UoM (lowercased code, given display name) and
 * inserts the pack atomically. If `isDefaultPurchase` is true, any existing
 * default on this product is cleared first.
 */
export type DefinePackInlineInput = {
  productId: string
  unitCode: string
  unitName: string
  baseQty: number
  isDefaultPurchase: boolean
}

export function useDefinePackInline() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: DefinePackInlineInput): Promise<string> => {
      const { data, error } = await supabase.rpc('define_pack_inline', {
        p_product_id: input.productId,
        p_unit_code: input.unitCode,
        p_unit_name: input.unitName,
        p_base_qty: input.baseQty,
        p_is_default_purchase: input.isDefaultPurchase
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (_id, vars) => {
      void qc.invalidateQueries({
        queryKey: ['product_packs', vars.productId]
      })
      void qc.invalidateQueries({ queryKey: ['units_of_measure'] })
      void qc.invalidateQueries({ queryKey: ['product_stock_display'] })
    }
  })
}

export type UpdatePackInput = {
  packId: string
  productId: string
  baseQty: number
  isDefaultPurchase: boolean
}

export function useUpdatePack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdatePackInput): Promise<void> => {
      const { error } = await supabase.rpc('update_pack', {
        p_pack_id: input.packId,
        p_base_qty: input.baseQty,
        p_is_default_purchase: input.isDefaultPurchase
      })
      if (error) throw error
    },
    onSuccess: (_v, vars) => {
      void qc.invalidateQueries({
        queryKey: ['product_packs', vars.productId]
      })
      void qc.invalidateQueries({ queryKey: ['product_stock_display'] })
    }
  })
}

/**
 * Stock-in form's per-line unit picker. Returns ALL active units for a product
 * (base + every active pack) — there's no sellability concept on packs in
 * v2.1, so every active pack is purchasable. Default selection is the pack
 * with `is_default_purchase=true`, falling back to base.
 */
export type PurchasableUnit = {
  kind: 'base' | 'pack'
  packId: string | null
  unitName: string
  baseQty: number
  isDefaultPurchase: boolean
}

export async function fetchPurchasableUnitsForProduct(args: {
  productId: string
  baseUnitName: string
}): Promise<PurchasableUnit[]> {
  const { productId, baseUnitName } = args
  const { data, error } = await supabase
    .from('product_packs')
    .select(
      'id, base_qty, is_default_purchase, units_of_measure:unit_id (name)'
    )
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('base_qty', { ascending: true })
  if (error) throw error

  const units: PurchasableUnit[] = [
    {
      kind: 'base',
      packId: null,
      unitName: baseUnitName,
      baseQty: 1,
      isDefaultPurchase: false
    }
  ]
  for (const row of (data ?? []) as Array<{
    id: string
    base_qty: number
    is_default_purchase: boolean
    units_of_measure: { name: string } | null
  }>) {
    units.push({
      kind: 'pack',
      packId: row.id,
      unitName: row.units_of_measure?.name ?? '',
      baseQty: row.base_qty,
      isDefaultPurchase: row.is_default_purchase
    })
  }
  return units
}

/**
 * Pack-aware stock breakdown for the visible page of products. One round-trip
 * via the product_stock_display view. v2.1 requires that `whole_packs` and
 * `remainder_base` come from the view, not from frontend math (spec §5.2).
 */
export type ProductStockPack = {
  pack_id: string
  unit_code: string
  unit_name: string
  base_qty: number
  whole_packs: number
  remainder_base: number
  is_default_purchase: boolean
}

export type ProductStockBreakdown = {
  product_id: string
  base_qty: number
  base_unit_code: string
  base_unit_name: string
  is_scan_only: boolean
  pack_breakdown: ProductStockPack[]
}

export function useProductStockBreakdowns(productIds: string[]) {
  const sortedKey = [...productIds].sort()
  return useQuery({
    queryKey: ['product_stock_display', sortedKey],
    enabled: productIds.length > 0,
    queryFn: async (): Promise<Map<string, ProductStockBreakdown>> => {
      const { data, error } = await supabase
        .from('product_stock_display')
        .select(
          'product_id, base_qty, base_unit_code, base_unit_name, is_scan_only, pack_breakdown'
        )
        .in('product_id', productIds)
      if (error) throw error
      const map = new Map<string, ProductStockBreakdown>()
      for (const row of (data ?? []) as Array<ProductStockBreakdown>) {
        if (row.product_id) map.set(row.product_id, row)
      }
      return map
    },
    staleTime: 30_000
  })
}

export function useDeactivatePack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      packId
    }: {
      packId: string
      productId: string
    }): Promise<void> => {
      const { error } = await supabase.rpc('deactivate_pack', {
        p_pack_id: packId
      })
      if (error) throw error
    },
    onSuccess: (_v, vars) => {
      void qc.invalidateQueries({
        queryKey: ['product_packs', vars.productId]
      })
      void qc.invalidateQueries({ queryKey: ['product_stock_display'] })
    }
  })
}
