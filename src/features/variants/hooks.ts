import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'

export type VariantAttribute = {
  id: string
  name: string
  display_order: number
  value_count: number
}

export type VariantAttributeValue = {
  id: string
  value: string
  display_order: number
}

export type VariantAttributesError = {
  message?: string
  code?: string
}

/**
 * Map server-side raise exception messages to i18n keys. Keep in sync with
 * the SQL function bodies in 0046_v27_attribute_rpcs.sql.
 */
export function variantAttributeErrorKey(err: unknown): string | null {
  const msg = (err as VariantAttributesError)?.message ?? ''
  if (msg.includes('attribute_already_exists'))
    return 'variant_attributes:errors.duplicate_name'
  if (msg.includes('attribute_in_use_cannot_archive'))
    return 'variant_attributes:errors.in_use_cannot_archive'
  if (msg.includes('value_already_exists'))
    return 'variant_attributes:errors.duplicate_value'
  if (msg.includes('value_in_use_cannot_archive'))
    return 'variant_attributes:errors.value_in_use_cannot_archive'
  if (msg.includes('attribute_name_blank') || msg.includes('value_blank'))
    return 'variant_attributes:errors.blank_name'
  return null
}

export function useVariantAttributes(query = '') {
  const trimmed = query.trim()
  return useQuery({
    queryKey: ['variant_attributes', 'search', trimmed],
    queryFn: async (): Promise<VariantAttribute[]> => {
      const { data, error } = await supabase.rpc('search_variant_attributes', {
        p_query: trimmed || undefined
      })
      if (error) throw error
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        display_order: row.display_order ?? 0,
        value_count: Number(row.value_count ?? 0)
      }))
    },
    staleTime: 30_000
  })
}

export function useAttributeValues(attributeId: string | null | undefined) {
  return useQuery({
    queryKey: ['variant_attributes', 'values', attributeId],
    enabled: !!attributeId,
    queryFn: async (): Promise<VariantAttributeValue[]> => {
      if (!attributeId) return []
      const { data, error } = await supabase.rpc('list_attribute_values', {
        p_attribute_id: attributeId
      })
      if (error) throw error
      return (data ?? []).map((row) => ({
        id: row.id,
        value: row.value,
        display_order: row.display_order ?? 0
      }))
    },
    staleTime: 30_000
  })
}

export function useCreateVariantAttribute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; display_order?: number }) => {
      const { data, error } = await supabase.rpc('create_variant_attribute', {
        p_name: input.name,
        p_display_order: input.display_order ?? 0
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['variant_attributes'] })
    }
  })
}

export function useUpdateVariantAttribute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      name?: string
      display_order?: number
      is_active?: boolean
    }) => {
      const { error } = await supabase.rpc('update_variant_attribute', {
        p_id: input.id,
        p_name: input.name ?? undefined,
        p_display_order:
          input.display_order === undefined ? undefined : input.display_order,
        p_is_active: input.is_active ?? undefined
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['variant_attributes'] })
    }
  })
}

export function useDeactivateVariantAttribute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('deactivate_variant_attribute', {
        p_id: id
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['variant_attributes'] })
    }
  })
}

export function useAddVariantValue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      attribute_id: string
      value: string
      display_order?: number
    }) => {
      const { data, error } = await supabase.rpc('add_variant_value', {
        p_attribute_id: input.attribute_id,
        p_value: input.value,
        p_display_order: input.display_order ?? 0
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['variant_attributes'] })
    }
  })
}

export function useUpdateVariantValue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      value?: string
      display_order?: number
      is_active?: boolean
    }) => {
      const { error } = await supabase.rpc('update_variant_value', {
        p_id: input.id,
        p_value: input.value ?? undefined,
        p_display_order:
          input.display_order === undefined ? undefined : input.display_order,
        p_is_active: input.is_active ?? undefined
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['variant_attributes'] })
    }
  })
}

export function useDeactivateVariantValue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('deactivate_variant_value', {
        p_id: id
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['variant_attributes'] })
    }
  })
}
