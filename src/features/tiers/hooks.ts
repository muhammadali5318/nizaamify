import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'

export type CustomerTier = {
  id: string
  shop_id: string
  name: string
  discount_percent: number
  is_default: boolean
  is_active: boolean
  notes: string | null
  /** Live count of customers currently on this tier (joined client-side). */
  customer_count: number
}

/**
 * Lists all active tiers for the current shop, joining a customer count via
 * a lightweight aggregation query.
 */
export function useTiers() {
  return useQuery({
    queryKey: ['customer_tiers'],
    queryFn: async (): Promise<CustomerTier[]> => {
      const [tiersRes, countsRes] = await Promise.all([
        supabase
          .from('customer_tiers')
          .select(
            'id, shop_id, name, discount_percent, is_default, is_active, notes'
          )
          .eq('is_active', true)
          .order('discount_percent', { ascending: false }),
        supabase.from('customers').select('tier_id')
      ])
      if (tiersRes.error) throw tiersRes.error
      if (countsRes.error) throw countsRes.error
      const counts = new Map<string, number>()
      for (const row of (countsRes.data ?? []) as Array<{
        tier_id: string | null
      }>) {
        if (row.tier_id)
          counts.set(row.tier_id, (counts.get(row.tier_id) ?? 0) + 1)
      }
      return (
        (tiersRes.data ?? []) as Omit<CustomerTier, 'customer_count'>[]
      ).map((t) => ({ ...t, customer_count: counts.get(t.id) ?? 0 }))
    },
    staleTime: 30_000
  })
}

export type DefineTierInput = {
  name: string
  discountPercent: number
  isDefault: boolean
  notes: string | null
}

export function useDefineTier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: DefineTierInput): Promise<string> => {
      const { data, error } = await supabase.rpc('define_tier', {
        p_name: input.name,
        p_discount_percent: input.discountPercent,
        p_is_default: input.isDefault,
        p_notes: input.notes ?? undefined
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['customer_tiers'] })
    }
  })
}

export type UpdateTierInput = {
  tierId: string
  name: string
  discountPercent: number
  isDefault: boolean
  notes: string | null
}

export function useUpdateTier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateTierInput): Promise<void> => {
      const { error } = await supabase.rpc('update_tier', {
        p_tier_id: input.tierId,
        p_name: input.name,
        p_discount_percent: input.discountPercent,
        p_is_default: input.isDefault,
        p_notes: input.notes ?? undefined
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['customer_tiers'] })
      void qc.invalidateQueries({ queryKey: ['customers'] })
    }
  })
}

/** Deactivates a tier and reassigns its customers to the shop's default.
 * Returns the count of reassigned customers so the UI can toast it. */
export function useDeactivateTier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tierId: string): Promise<number> => {
      const { data, error } = await supabase.rpc('deactivate_tier', {
        p_tier_id: tierId
      })
      if (error) throw error
      return Number(data ?? 0)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['customer_tiers'] })
      void qc.invalidateQueries({ queryKey: ['customers'] })
    }
  })
}

export function useSetDefaultTier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tierId: string): Promise<void> => {
      const { error } = await supabase.rpc('set_default_tier', {
        p_tier_id: tierId
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['customer_tiers'] })
    }
  })
}

/** Maps known v2.2 RPC error codes to i18n keys. */
export function tierErrorKey(err: unknown): string | null {
  const msg =
    typeof (err as { message?: unknown })?.message === 'string'
      ? (err as { message: string }).message
      : ''
  if (msg.includes('tier_name_duplicate')) return 'tiers:errors.duplicate_name'
  if (msg.includes('tier_discount_out_of_range'))
    return 'tiers:errors.discount_out_of_range'
  if (msg.includes('cannot_archive_default_tier'))
    return 'tiers:errors.cannot_archive_default'
  if (msg.includes('cannot_unset_default_tier'))
    return 'tiers:errors.cannot_unset_default'
  if (msg.includes('tier_name_required')) return 'tiers:errors.name_required'
  return null
}
