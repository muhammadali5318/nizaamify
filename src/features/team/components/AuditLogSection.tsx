import { useState } from 'react'
import {
  Box,
  Button as MuiButton,
  CircularProgress,
  Collapse,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useTranslation } from 'react-i18next'
import { Card } from 'src/components/ui'
import { usePermissionAuditLog } from 'src/features/team/hooks'

interface AuditLogSectionProps {
  /** Whether the caller has view_user_audit_log; renders nothing if false. */
  canView: boolean
}

type AuditRow = {
  id: string
  target_user_id: string
  target_email: string | null
  actor_user_id: string
  actor_email: string | null
  permission_key: string | null
  old_granted: boolean | null
  new_granted: boolean | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  action: string
  reason: string | null
  changed_at: string
}

export function AuditLogSection({ canView }: AuditLogSectionProps) {
  const { t, i18n } = useTranslation('team')
  const [expanded, setExpanded] = useState(false)
  const [limit, setLimit] = useState(50)
  const auditQ = usePermissionAuditLog(limit, 0)

  if (!canView) return null

  const rows = (auditQ.data ?? []) as AuditRow[]

  return (
    <Card sx={{ p: 0 }}>
      <MuiButton
        onClick={() => setExpanded((v) => !v)}
        startIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        sx={{
          width: '100%',
          justifyContent: 'flex-start',
          textTransform: 'none',
          paddingInline: 2,
          paddingBlock: 1.5,
          color: 'var(--text-primary)',
          fontWeight: 600,
          borderRadius: 0
        }}
      >
        {expanded ? t('audit.hide') : t('audit.show')}
      </MuiButton>
      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ borderTop: '1px solid var(--border-subtle)' }}>
          {auditQ.isLoading ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <CircularProgress size={18} />
              <Typography
                variant='caption'
                sx={{ display: 'block', mt: 1, color: 'var(--text-secondary)' }}
              >
                {t('audit.loading')}
              </Typography>
            </Box>
          ) : rows.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography
                variant='body2'
                sx={{ color: 'var(--text-secondary)' }}
              >
                {t('audit.empty')}
              </Typography>
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('audit.column_when')}</TableCell>
                      <TableCell>{t('audit.column_actor')}</TableCell>
                      <TableCell>{t('audit.column_target')}</TableCell>
                      <TableCell>{t('audit.column_action')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell>
                          <Typography variant='caption'>
                            {new Date(row.changed_at).toLocaleString(
                              i18n.language,
                              {
                                dateStyle: 'short',
                                timeStyle: 'short'
                              }
                            )}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant='body2'>
                            {row.actor_email ?? '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant='body2'>
                            {row.target_email ?? '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <ActionLabel row={row} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {rows.length >= limit && (
                <Stack
                  direction='row'
                  justifyContent='center'
                  sx={{ p: 1.5, borderTop: '1px solid var(--border-subtle)' }}
                >
                  <MuiButton
                    size='small'
                    onClick={() => setLimit((l) => l + 50)}
                  >
                    {t('audit.load_more')}
                  </MuiButton>
                </Stack>
              )}
            </>
          )}
        </Box>
      </Collapse>
    </Card>
  )
}

function ActionLabel({ row }: { row: AuditRow }) {
  const { t } = useTranslation('team')
  switch (row.action) {
    case 'preset_applied':
      return (
        <Typography variant='caption'>
          {t('audit.action_preset_applied', {
            preset: row.new_value?.preset as string
          })}
        </Typography>
      )
    case 'permission_granted':
      return (
        <Typography variant='caption'>
          {t('audit.action_permission_granted', {
            permission: row.permission_key
          })}
        </Typography>
      )
    case 'permission_revoked':
      return (
        <Typography variant='caption'>
          {t('audit.action_permission_revoked', {
            permission: row.permission_key
          })}
        </Typography>
      )
    case 'discount_limits_updated':
      return (
        <Typography variant='caption'>
          {t('audit.action_discount_limits_updated')}
        </Typography>
      )
    case 'invitation_created':
      return (
        <Typography variant='caption'>
          {t('audit.action_invitation_created')}
        </Typography>
      )
    case 'invitation_accepted':
      return (
        <Typography variant='caption'>
          {t('audit.action_invitation_accepted')}
        </Typography>
      )
    case 'invitation_cancelled':
      return (
        <Typography variant='caption'>
          {t('audit.action_invitation_cancelled')}
        </Typography>
      )
    case 'access_revoked':
      return (
        <Typography variant='caption'>
          {t('audit.action_access_revoked')}
        </Typography>
      )
    default:
      return <Typography variant='caption'>{row.action}</Typography>
  }
}

export default AuditLogSection
