import {
  CircularProgress,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography
} from '@mui/material'
import CancelIcon from '@mui/icons-material/CancelOutlined'
import WarningIcon from '@mui/icons-material/WarningAmberOutlined'
import { useTranslation } from 'react-i18next'
import { Badge, Card } from 'src/components/ui'
import type { usePendingInvitations } from 'src/features/team/hooks'

type InvitationRow = NonNullable<
  ReturnType<typeof usePendingInvitations>['data']
>[number]

interface PendingInvitationsTableProps {
  rows: InvitationRow[] | undefined
  isLoading: boolean
  onCancel: (row: InvitationRow) => void
}

export function PendingInvitationsTable({
  rows,
  isLoading,
  onCancel
}: PendingInvitationsTableProps) {
  const { t, i18n } = useTranslation('team')

  if (isLoading) {
    return (
      <Card sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress size={20} />
      </Card>
    )
  }

  // Only show pending status rows (cancelled / expired / accepted are noise here)
  const pending = (rows ?? []).filter((r) => r.status === 'pending')

  if (pending.length === 0) {
    return (
      <Card variant='muted' sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant='body2' sx={{ color: 'var(--text-secondary)' }}>
          {t('invitations.empty_label')}
        </Typography>
      </Card>
    )
  }

  return (
    <Card sx={{ p: 0, overflow: 'hidden' }}>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('invitations.column_email')}</TableCell>
              <TableCell>{t('invitations.column_preset')}</TableCell>
              <TableCell>{t('invitations.column_invited_by')}</TableCell>
              <TableCell>{t('invitations.column_expires')}</TableCell>
              <TableCell>{t('invitations.column_status')}</TableCell>
              <TableCell align='right'>
                {t('invitations.column_actions')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pending.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>
                  <Typography variant='body2' sx={{ fontWeight: 600 }}>
                    {row.email}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Badge variant='neutral'>
                    {row.preset_applied === 'manager'
                      ? t('members.preset_manager')
                      : t('members.preset_salesperson')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Typography variant='caption'>
                    {row.invited_by_email ?? '—'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography
                    variant='caption'
                    sx={{ color: 'var(--text-secondary)' }}
                  >
                    {new Date(row.expires_at).toLocaleString(i18n.language, {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </Typography>
                </TableCell>
                <TableCell>
                  {row.failed_attempts > 0 ? (
                    <Stack
                      direction='row'
                      alignItems='center'
                      gap={0.5}
                      sx={{ color: 'var(--status-warning-text)' }}
                    >
                      <WarningIcon fontSize='small' />
                      <Typography variant='caption'>
                        {t('invitations.failed_attempts_warning', {
                          count: row.failed_attempts
                        })}
                      </Typography>
                    </Stack>
                  ) : (
                    <Badge variant='info'>{row.status}</Badge>
                  )}
                </TableCell>
                <TableCell align='right'>
                  <Tooltip title={t('invitations.cancel')}>
                    <IconButton
                      size='small'
                      aria-label={t('invitations.cancel')}
                      onClick={() => onCancel(row)}
                    >
                      <CancelIcon fontSize='small' />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  )
}

export default PendingInvitationsTable
