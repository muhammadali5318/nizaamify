import { useState } from 'react'
import { Alert, Button, Stack } from '@mui/material'
import { Link as RouterLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useEffectiveSubscription } from 'src/features/auth/hooks'
import { paths } from 'src/paths'

type BannerKind =
  | 'subscription_suspended'
  | 'subscription_expired'
  | 'trial_ending_soon'
  | 'trial_reminder'
  | 'subscription_renewal_due'
  | 'subscription_renewal_reminder'
  | null

const SEVERITY: Record<
  Exclude<BannerKind, null>,
  'error' | 'warning' | 'info'
> = {
  subscription_suspended: 'error',
  subscription_expired: 'error',
  trial_ending_soon: 'warning',
  trial_reminder: 'info',
  subscription_renewal_due: 'warning',
  subscription_renewal_reminder: 'info'
}

function daysBetween(now: Date, future: Date): number {
  const ms = future.getTime() - now.getTime()
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

function pickBanner(
  data: ReturnType<typeof useEffectiveSubscription>['data']
): { kind: BannerKind; daysLeft: number } {
  if (!data) return { kind: null, daysLeft: 0 }

  if (data.effective_status === 'suspended') {
    return { kind: 'subscription_suspended', daysLeft: 0 }
  }
  if (data.effective_status === 'expired') {
    return { kind: 'subscription_expired', daysLeft: 0 }
  }

  const now = new Date()

  if (data.status === 'trial' && data.trial_ends_at) {
    const days = daysBetween(now, new Date(data.trial_ends_at))
    if (days <= 3) return { kind: 'trial_ending_soon', daysLeft: days }
    if (days <= 7) return { kind: 'trial_reminder', daysLeft: days }
    return { kind: null, daysLeft: 0 }
  }

  if (data.status === 'active' && data.current_period_ends_at) {
    const days = daysBetween(now, new Date(data.current_period_ends_at))
    if (days <= 5) return { kind: 'subscription_renewal_due', daysLeft: days }
    if (days <= 10)
      return { kind: 'subscription_renewal_reminder', daysLeft: days }
    return { kind: null, daysLeft: 0 }
  }

  return { kind: null, daysLeft: 0 }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function DashboardBanner() {
  const { t } = useTranslation('subscription')
  const { data } = useEffectiveSubscription()
  const { kind, daysLeft } = pickBanner(data)

  const dismissKey = kind ? `banner_${kind}_${todayKey()}` : null
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (!dismissKey) return false
    if (typeof window === 'undefined') return false
    return localStorage.getItem(dismissKey) === '1'
  })

  if (!kind || dismissed) return null

  const severity = SEVERITY[kind]
  const dismissible = severity === 'info'

  const message = (() => {
    if (kind === 'subscription_suspended' || kind === 'subscription_expired') {
      return t(`banner.${kind}`)
    }
    return t(`banner.${kind}`, { count: daysLeft, daysLeft })
  })()

  let actionLabel: string | null = null
  let actionTo = paths.subscriptionExpired
  if (kind === 'subscription_suspended') {
    actionLabel = t('banner.actions.contact_support')
    actionTo = paths.support
  } else if (kind === 'subscription_expired') {
    actionLabel = t('banner.actions.pay_now')
    actionTo = paths.subscriptionExpired
  } else if (kind === 'trial_ending_soon') {
    actionLabel = t('banner.actions.pay_now')
    actionTo = paths.support
  } else if (kind === 'trial_reminder') {
    actionLabel = t('banner.actions.view_payment')
    actionTo = paths.support
  } else if (kind === 'subscription_renewal_due') {
    actionLabel = t('banner.actions.renew')
    actionTo = paths.support
  } else if (kind === 'subscription_renewal_reminder') {
    actionLabel = t('banner.actions.renew_early')
    actionTo = paths.support
  }

  const onDismiss = () => {
    if (!dismissKey) return
    localStorage.setItem(dismissKey, '1')
    setDismissed(true)
  }

  return (
    <Alert
      severity={severity}
      onClose={dismissible ? onDismiss : undefined}
      sx={{ borderRadius: 0 }}
      action={
        actionLabel ? (
          <Stack direction='row' spacing={1} alignItems='center'>
            <Button
              component={RouterLink}
              to={actionTo}
              size='small'
              color='inherit'
              variant='outlined'
            >
              {actionLabel}
            </Button>
          </Stack>
        ) : undefined
      }
    >
      {message}
    </Alert>
  )
}
