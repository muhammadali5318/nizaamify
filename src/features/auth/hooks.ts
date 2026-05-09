import { useQuery } from '@tanstack/react-query'
import { supabase } from 'src/lib/supabase'
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
