// v2.9.1 D.4 — /invite/accept/:invitation_id page.
//
// Layout: two-column with shop branding (B.4 picked). Left column
// surfaces *what* the invitee is joining (shop name, who invited them,
// preset). Right column surfaces *how* (4-digit verbal code + accept).
//
// Realities for v2.9.1 ship:
//  - Invitee must already have a Supabase auth account at the invited
//    email (signed up via /signup, verified, logged in). Programmatic
//    password-set-during-accept requires admin API; deferred to v2.10.
//  - Onboarding bypass: after a successful accept, this page self-updates
//    `profiles.onboarding_completed = true` (profiles_self_update policy
//    admits this). Otherwise RequireOnboarded redirects them away from
//    /dashboard. The invitee never gets the owner onboarding wizard.
//  - Server raises drive the UX: get_invitation_for_acceptance reveals
//    metadata only on email match; accept_invitation enforces 5-strike
//    auto-cancel + email re-check + status validation.

import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import {
  Alert,
  Box,
  Card as MuiCard,
  CircularProgress,
  Stack,
  Typography
} from '@mui/material'
import StoreOutlinedIcon from '@mui/icons-material/StoreOutlined'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Field, Input } from 'src/components/ui'
import { useSession } from 'src/features/auth/AuthProvider'
import {
  useAcceptInvitation,
  useGetInvitation,
  useSetActiveShop,
  useUserShopList
} from 'src/features/team/hooks'
import { mapErrorToI18nKey } from 'src/lib/errorMap'
import { supabase } from 'src/lib/supabase'
import { paths } from 'src/paths'

export default function AcceptInvitationPage() {
  const { t } = useTranslation('invitation')
  const params = useParams<{ invitation_id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useSession()
  const invitationId = params.invitation_id

  const invitationQ = useGetInvitation(invitationId)
  const accept = useAcceptInvitation()
  const setActiveShop = useSetActiveShop()
  const userShopListQ = useUserShopList()
  const [code, setCode] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Server returns the *post-increment* attempts on each rejection;
  // we display attempts-left = 5 - attempts.
  const [attemptsUsed, setAttemptsUsed] = useState(0)
  const [accepted, setAccepted] = useState(false)

  // Initialize attemptsUsed from server response on first load
  useEffect(() => {
    if (invitationQ.data?.failed_attempts != null) {
      setAttemptsUsed(invitationQ.data.failed_attempts)
    }
  }, [invitationQ.data?.failed_attempts])

  // After acceptance: redirect once user_shop_list has the new shop.
  // useEffect ensures the side effect fires exactly once when the
  // newly-joined shop appears in the list (not on every render).
  const acceptedShopName = invitationQ.data?.shop_name
  useEffect(() => {
    if (!accepted) return
    const newShop = userShopListQ.data?.find(
      (s) => s.shop_name === acceptedShopName
    )
    if (!newShop) return
    void (async () => {
      try {
        await setActiveShop.mutateAsync(newShop.shop_id)
      } catch {
        // Ignore — even if set_active_shop fails the fallback path resolves
      }
      navigate(paths.dashboard, { replace: true })
    })()
  }, [accepted, acceptedShopName, userShopListQ.data, setActiveShop, navigate])

  if (!invitationId) {
    return <Navigate to={paths.dashboard} replace />
  }
  if (!user) {
    // Should not happen — RequireAuth wraps this route. Defensive only.
    return <Navigate to={paths.login} replace />
  }

  if (accepted) return <FullScreenLoader t={t} />

  // ---- Loading state -----------------------------------------------------
  if (invitationQ.isLoading) {
    return <FullScreenLoader t={t} />
  }

  // ---- Error states ------------------------------------------------------
  if (invitationQ.isError) {
    const key = mapErrorToI18nKey(invitationQ.error)
    return (
      <FinalStateScreen
        title={
          key === 'errors.invitation_email_mismatch'
            ? t('errors.email_mismatch_title')
            : key === 'errors.invitation_not_found'
              ? t('errors.not_found_title')
              : t('errors.not_found_title')
        }
        body={
          key === 'errors.invitation_email_mismatch'
            ? t('errors.email_mismatch_body')
            : t('errors.not_found_body')
        }
        actionLabel={
          key === 'errors.invitation_email_mismatch'
            ? t('errors.sign_out_and_retry')
            : t('errors.back_to_dashboard')
        }
        onAction={async () => {
          if (key === 'errors.invitation_email_mismatch') {
            await supabase.auth.signOut()
            navigate(paths.login, { replace: true })
          } else {
            navigate(paths.dashboard, { replace: true })
          }
        }}
      />
    )
  }

  const inv = invitationQ.data
  if (!inv) {
    return (
      <FinalStateScreen
        title={t('errors.not_found_title')}
        body={t('errors.not_found_body')}
        actionLabel={t('errors.back_to_dashboard')}
        onAction={() => navigate(paths.dashboard, { replace: true })}
      />
    )
  }

  // Non-pending status: render an appropriate final-state screen
  if (inv.status === 'expired') {
    return (
      <FinalStateScreen
        title={t('errors.expired_title')}
        body={t('errors.expired_body')}
        actionLabel={t('errors.back_to_dashboard')}
        onAction={() => navigate(paths.dashboard, { replace: true })}
      />
    )
  }
  if (inv.status === 'cancelled') {
    return (
      <FinalStateScreen
        title={t('errors.cancelled_title')}
        body={
          attemptsUsed >= 5
            ? t('errors.auto_cancelled_5_strike')
            : t('errors.cancelled_body')
        }
        actionLabel={t('errors.back_to_dashboard')}
        onAction={() => navigate(paths.dashboard, { replace: true })}
      />
    )
  }
  if (inv.status === 'accepted') {
    return (
      <FinalStateScreen
        title={t('errors.accepted_title')}
        body={t('errors.accepted_body')}
        actionLabel={t('errors.back_to_dashboard')}
        onAction={() => navigate(paths.dashboard, { replace: true })}
      />
    )
  }

  // ---- Pending: render the two-column accept form -----------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    if (code.length !== 4) return
    try {
      await accept.mutateAsync({
        invitation_id: invitationId,
        confirmation_code: code
      })
      // Mark profile onboarded (invitees skip the owner wizard)
      if (user) {
        await supabase
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', user.id)
      }
      // v2.9.1 race fix — after the server-side commits, the React Query
      // cache for `profile` is invalidated but the refetch is async.
      // setAccepted(true) → render FullScreenLoader → useEffect fires
      // navigate(/dashboard) → AppShell mounts → RequireOnboarded reads
      // STALE profile cache (onboarding_completed=false) and — since the
      // invitation just transitioned to status='accepted' so
      // useMyPendingInvitation returns null — bounces the user to
      // /onboarding for ~5 seconds until the refetch lands.
      //
      // Fix: write the cache synchronously to match what we just
      // committed server-side. setQueryData is sync; the guards read the
      // correct value on the very next render. Also clear the pending-
      // invitation cache so useMyPendingInvitation returns null
      // immediately without a network round-trip.
      if (user) {
        queryClient.setQueryData(
          ['profile', user.id],
          (old: { onboarding_completed: boolean } | null | undefined) =>
            old ? { ...old, onboarding_completed: true } : old
        )
        queryClient.setQueryData(['my_pending_invitation', user.id], null)
      }
      // Refetch the shop list — useEffect waits for the new shop to
      // appear before triggering the navigate to /dashboard.
      await queryClient.invalidateQueries({ queryKey: ['user_shop_list'] })
      setAccepted(true)
    } catch (err) {
      const key = mapErrorToI18nKey(err)
      // Server raises invitation_not_pending with detail='auto_cancelled_5_strike'
      // when the 5th strike triggers cancellation. Refetch to update UX.
      if (key === 'errors.invalid_confirmation_code') {
        setAttemptsUsed((v) => v + 1)
        setCode('')
      }
      if (
        key === 'errors.invitation_not_pending' ||
        key === 'errors.invitation_expired'
      ) {
        // Status changed — refetch the invitation to render the final-state screen
        await invitationQ.refetch()
      }
      setSubmitError(key)
    }
  }

  const presetLabel =
    inv.preset_applied === 'manager'
      ? t('page.preset_manager')
      : t('page.preset_salesperson')
  const attemptsLeft = Math.max(0, 5 - attemptsUsed)
  const showAttemptsWarning = attemptsUsed > 0 && attemptsLeft > 0

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2, md: 4 },
        background: 'transparent' // Body glow reads through
      }}
    >
      <MuiCard
        sx={{
          width: '100%',
          maxWidth: 880,
          backgroundColor: 'var(--surface-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',
          backgroundImage: 'none'
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          divider={
            <Box
              sx={{
                borderRight: { md: '1px solid var(--border-subtle)' },
                borderBottom: { xs: '1px solid var(--border-subtle)', md: 0 }
              }}
            />
          }
        >
          {/* Left column — shop branding */}
          <Stack
            sx={{
              flex: 1,
              p: { xs: 3, md: 5 },
              gap: 2.5,
              justifyContent: 'center',
              minWidth: { md: 300 }
            }}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 'var(--radius-md)',
                backgroundColor:
                  'color-mix(in srgb, var(--text-brand) 12%, transparent)',
                color: 'var(--text-brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <StoreOutlinedIcon sx={{ fontSize: 32 }} />
            </Box>
            <Stack gap={0.5}>
              <Typography
                variant='caption'
                sx={{
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em'
                }}
              >
                {t('page.header_left', { shopName: '' }).split(' ')[0]}
              </Typography>
              <Typography
                component='h1'
                sx={{ fontSize: '1.75rem', fontWeight: 700 }}
              >
                {inv.shop_name}
              </Typography>
            </Stack>
            <Typography variant='body2' sx={{ color: 'var(--text-secondary)' }}>
              {t('page.invited_by', {
                email: inv.invited_by_email || '—'
              })}
            </Typography>
            <Stack gap={0.5}>
              <Typography
                variant='caption'
                sx={{ color: 'var(--text-secondary)' }}
              >
                {t('page.you_will_join_as')}
              </Typography>
              <Box>
                <Badge variant='brand'>{presetLabel}</Badge>
              </Box>
            </Stack>
          </Stack>

          {/* Right column — code entry form */}
          <Stack
            component='form'
            onSubmit={handleSubmit}
            sx={{
              flex: 1,
              p: { xs: 3, md: 5 },
              gap: 2.5,
              justifyContent: 'center',
              minWidth: { md: 320 }
            }}
          >
            <Field
              label={t('page.code_label')}
              helperText={t('page.code_helper')}
              required
            >
              <Input
                type='text'
                inputMode='numeric'
                value={code}
                onChange={(e) => {
                  // Only digits, max 4
                  const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 4)
                  setCode(v)
                }}
                placeholder='— — — —'
                maxLength={4}
                sx={{
                  '& input': {
                    fontSize: '1.75rem',
                    letterSpacing: '0.4em',
                    textAlign: 'center',
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace'
                  }
                }}
                autoComplete='one-time-code'
              />
            </Field>

            {showAttemptsWarning && (
              <Alert severity='warning' icon={false}>
                {t('page.attempts_remaining', {
                  count: attemptsLeft
                })}
              </Alert>
            )}

            {submitError &&
              submitError !== 'errors.invalid_confirmation_code' && (
                <Alert severity='error'>{t(`common:${submitError}`)}</Alert>
              )}

            <Button
              type='submit'
              loading={accept.isPending}
              disabled={code.length !== 4}
              fullWidth
            >
              {accept.isPending ? t('page.submitting') : t('page.submit')}
            </Button>
          </Stack>
        </Stack>
      </MuiCard>
    </Box>
  )
}

// ---------------------------------------------------------------------------

function FullScreenLoader({ t }: { t: (k: string) => string }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Stack alignItems='center' gap={1.5}>
        <CircularProgress />
        <Typography variant='caption' sx={{ color: 'var(--text-secondary)' }}>
          {t('page.loading')}
        </Typography>
      </Stack>
    </Box>
  )
}

function FinalStateScreen({
  title,
  body,
  actionLabel,
  onAction
}: {
  title: string
  body: string
  actionLabel: string
  onAction: () => void | Promise<void>
}) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2, md: 4 }
      }}
    >
      <MuiCard
        sx={{
          maxWidth: 480,
          width: '100%',
          p: { xs: 3, md: 5 },
          textAlign: 'center',
          backgroundColor: 'var(--surface-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-card)',
          backgroundImage: 'none'
        }}
      >
        <Stack gap={2}>
          <Typography variant='h2' component='h1'>
            {title}
          </Typography>
          <Typography variant='body2' sx={{ color: 'var(--text-secondary)' }}>
            {body}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
            <Button onClick={() => void onAction()}>{actionLabel}</Button>
          </Box>
        </Stack>
      </MuiCard>
    </Box>
  )
}
