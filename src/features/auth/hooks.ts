import { useQuery } from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'
import { getActiveShopId } from 'src/lib/activeShop'
import { useSession } from './AuthProvider'

export function useProfile() {
  const { user } = useSession()
  return useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, preferred_language, onboarding_completed')
        .eq('id', user.id)
        .single()
      if (error) throw error
      return data
    }
  })
}

/**
 * Returns the active shop's id + name for the current user. v2.9.1 rewrite:
 * uses the `get_active_shop` RPC (migration 0087) so non-owner team members
 * resolve correctly via the `app-shop-id` header (or single-shop fallback).
 * Previously filtered by `owner_user_id = auth.uid()` directly on the shops
 * table, which silently returned no rows for non-owners. Shape preserved
 * (`{ id, shop_name }`) for backward compatibility with existing callers.
 */
export function useShop() {
  const { user } = useSession()
  return useQuery({
    queryKey: ['shop', user?.id, getActiveShopId()],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null
      const { data, error } = await supabase.rpc('get_active_shop')
      if (error) throw error
      const row = (
        data as Array<{
          shop_id: string
          shop_name: string
          is_owner: boolean
        }> | null
      )?.[0]
      return row ? { id: row.shop_id, shop_name: row.shop_name } : null
    }
  })
}

type EffectiveStatus = 'trial' | 'active' | 'expired' | 'suspended'

export function useEffectiveSubscription() {
  const { user } = useSession()
  return useQuery({
    queryKey: ['subscription', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null
      const { data, error } = await supabase
        .from('subscriptions')
        .select(
          'status, trial_ends_at, current_period_ends_at, last_payment_date'
        )
        .eq('user_id', user.id)
        .single()
      if (error) throw error

      const now = Date.now()
      const trialEnd = data.trial_ends_at
        ? new Date(data.trial_ends_at).getTime()
        : null
      const periodEnd = data.current_period_ends_at
        ? new Date(data.current_period_ends_at).getTime()
        : null

      let effective: EffectiveStatus = data.status
      if (data.status === 'trial' && trialEnd !== null && now > trialEnd) {
        effective = 'expired'
      } else if (
        data.status === 'active' &&
        periodEnd !== null &&
        now > periodEnd
      ) {
        effective = 'expired'
      }

      return {
        status: data.status as EffectiveStatus,
        effective_status: effective,
        trial_ends_at: data.trial_ends_at,
        current_period_ends_at: data.current_period_ends_at,
        last_payment_date: data.last_payment_date
      }
    }
  })
}
