// v2.9.1 Phase D.3 — /settings/team page.
//
// Gated route-level by RequirePermission('view_team'); also short-circuits
// when RBAC_TEAM_UI_ENABLED feature flag is OFF (B.9 — pilot rollout).

import { useState } from 'react'
import { Navigate } from 'react-router'
import { Box, Snackbar, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { Button } from 'src/components/ui'
import { paths } from 'src/paths'
import { RBAC_TEAM_UI_ENABLED } from 'src/lib/featureFlags'
import { usePermission } from 'src/lib/permissions'
import {
  useCancelInvitation,
  usePendingInvitations,
  useTeam
} from 'src/features/team/hooks'
import { mapErrorToI18nKey } from 'src/lib/errorMap'
import TeamMembersTable from './components/TeamMembersTable'
import PendingInvitationsTable from './components/PendingInvitationsTable'
import InviteUserDialog from './components/InviteUserDialog'
import EditPermissionsDialog from './components/EditPermissionsDialog'
import EditDiscountLimitsDialog from './components/EditDiscountLimitsDialog'
import RevokeAccessConfirmDialog from './components/RevokeAccessConfirmDialog'
import AuditLogSection from './components/AuditLogSection'

type TeamRow = NonNullable<ReturnType<typeof useTeam>['data']>[number]

export default function TeamPage() {
  const { t } = useTranslation('team')
  const teamQ = useTeam()
  const invitationsQ = usePendingInvitations()
  const cancelInvitation = useCancelInvitation()
  const canInvite = usePermission('invite_users')
  const canViewAudit = usePermission('view_user_audit_log')

  const [inviteOpen, setInviteOpen] = useState(false)
  const [editPermissions, setEditPermissions] = useState<TeamRow | null>(null)
  const [editLimits, setEditLimits] = useState<TeamRow | null>(null)
  const [revokeMember, setRevokeMember] = useState<TeamRow | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  if (!RBAC_TEAM_UI_ENABLED) {
    return <Navigate to={paths.dashboard} replace />
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
      <Stack gap={4}>
        {/* Header */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent='space-between'
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          gap={1.5}
        >
          <Stack gap={0.5}>
            <Typography variant='h1' component='h1'>
              {t('page.title')}
            </Typography>
            <Typography variant='body2' sx={{ color: 'var(--text-secondary)' }}>
              {t('page.subtitle')}
            </Typography>
          </Stack>
          {canInvite && (
            <Button onClick={() => setInviteOpen(true)}>
              {t('invite.button')}
            </Button>
          )}
        </Stack>

        {/* Active team members */}
        <Stack gap={1.5}>
          <Typography
            variant='caption'
            sx={{
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-secondary)'
            }}
          >
            {t('members.section_title')}
          </Typography>
          <TeamMembersTable
            rows={teamQ.data}
            isLoading={teamQ.isLoading}
            onEditPermissions={setEditPermissions}
            onEditDiscountLimits={setEditLimits}
            onRevokeAccess={setRevokeMember}
          />
        </Stack>

        {/* Pending invitations */}
        <Stack gap={1.5}>
          <Typography
            variant='caption'
            sx={{
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-secondary)'
            }}
          >
            {t('invitations.section_title')}
          </Typography>
          <PendingInvitationsTable
            rows={invitationsQ.data}
            isLoading={invitationsQ.isLoading}
            onCancel={async (row) => {
              try {
                await cancelInvitation.mutateAsync(row.id)
              } catch (err) {
                setToast(mapErrorToI18nKey(err))
              }
            }}
          />
        </Stack>

        {/* Audit log (collapsible, gated on view_user_audit_log) */}
        {canViewAudit && (
          <Stack gap={1.5}>
            <Typography
              variant='caption'
              sx={{
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-secondary)'
              }}
            >
              {t('audit.section_title')}
            </Typography>
            <AuditLogSection canView={canViewAudit} />
          </Stack>
        )}
      </Stack>

      {/* Dialogs */}
      <InviteUserDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />
      <EditPermissionsDialog
        open={!!editPermissions}
        onClose={() => setEditPermissions(null)}
        member={editPermissions}
      />
      <EditDiscountLimitsDialog
        open={!!editLimits}
        onClose={() => setEditLimits(null)}
        member={editLimits}
      />
      <RevokeAccessConfirmDialog
        open={!!revokeMember}
        onClose={() => setRevokeMember(null)}
        member={revokeMember}
      />

      {/* Toast for cancel-invitation errors */}
      <Snackbar
        open={!!toast}
        autoHideDuration={6000}
        onClose={() => setToast(null)}
        message={toast ? t(`common:${toast}`) : ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      />
    </Box>
  )
}
