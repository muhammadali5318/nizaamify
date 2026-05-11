import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'

export type Category = {
  id: string
  name: string
  product_count: number
}

export function useSearchCategories(query: string, limit = 10) {
  const trimmed = query.trim()
  return useQuery({
    queryKey: ['categories', 'search', { query: trimmed, limit }],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase.rpc('search_categories', {
        p_query: trimmed || undefined,
        p_limit: limit,
        p_offset: 0
      })
      if (error) throw error
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        product_count: Number(row.product_count ?? 0)
      }))
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev
  })
}

export function useCategory(id: string | null | undefined) {
  return useQuery({
    queryKey: ['categories', 'one', id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('product_categories')
        .select('id, name, is_active')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    }
  })
}

export function useCreateCategoryInline() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string): Promise<string> => {
      const { data, error } = await supabase.rpc('create_category_inline', {
        p_name: name
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] })
    }
  })
}
