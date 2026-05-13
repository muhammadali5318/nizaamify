import {
  Box,
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
import EditIcon from '@mui/icons-material/EditOutlined'
import PriceChangeIcon from '@mui/icons-material/PriceChangeOutlined'
import LogoutIcon from '@mui/icons-material/LogoutOutlined'
import { useTranslation } from 'react-i18next'
import { Badge, Card } from 'src/components/ui'
import type { useTeam } from 'src/features/team/hooks'

type TeamRow = NonNullable<ReturnType<typeof useTeam>['data']>[number]

interface TeamMembersTableProps {
  rows: TeamRow[] | undefined
  isLoading: boolean
  onEditPermissions: (row: TeamRow) => void
  onEditDiscountLimits: (row: TeamRow) => void
  onRevokeAccess: (row: TeamRow) => void
}

export function TeamMembersTable({
  rows,
  isLoading,
  onEditPermissions,
  onEditDiscountLimits,
  onRevokeAccess
}: TeamMembersTableProps) {
  const { t, i18n } = useTranslation('team')

  if (isLoading) {
    return (
      <Card sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress size={20} />
      </Card>
    )
  }

  if (!rows || rows.length === 0) {
    return (
      <Card variant='muted' sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant='body2' sx={{ color: 'var(--text-secondary)' }}>
          {t('members.empty_label')}
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
              <TableCell>{t('members.column_email')}</TableCell>
              <TableCell>{t('members.column_role')}</TableCell>
              <TableCell align='end' sx={{ textAlign: 'end' }}>
                {t('members.column_permissions')}
              </TableCell>
              <TableCell>{t('members.column_joined')}</TableCell>
              <TableCell align='end' sx={{ textAlign: 'end' }}>
                {t('members.column_actions')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.user_id} hover>
                <TableCell>
                  <Typography variant='body2' sx={{ fontWeight: 600 }}>
                    {row.email}
                  </Typography>
                </TableCell>
                <TableCell>
                  <RoleBadge row={row} />
                </TableCell>
                <TableCell align='end' sx={{ textAlign: 'end' }}>
                  {row.is_owner ? (
                    <Typography
                      variant='caption'
                      sx={{ color: 'var(--text-secondary)' }}
                    >
                      —
                    </Typography>
                  ) : (
                    <Typography variant='body2'>
                      {t('members.granted_count', {
                        count: row.granted_permission_count
                      })}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Typography
                    variant='caption'
                    sx={{ color: 'var(--text-secondary)' }}
                  >
                    {new Date(row.joined_at).toLocaleDateString(i18n.language)}
                  </Typography>
                </TableCell>
                <TableCell align='end'>
                  {row.is_owner ? (
                    <Typography
                      variant='caption'
                      sx={{ color: 'var(--text-muted)' }}
                    >
                      —
                    </Typography>
                  ) : (
                    <Stack direction='row' gap={0.5} justifyContent='flex-end'>
                      <Tooltip title={t('members.edit_permissions')}>
                        <IconButton
                          size='small'
                          aria-label={t('members.edit_permissions')}
                          onClick={() => onEditPermissions(row)}
                        >
                          <EditIcon fontSize='small' />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('members.edit_discount_limits')}>
                        <IconButton
                          size='small'
                          aria-label={t('members.edit_discount_limits')}
                          onClick={() => onEditDiscountLimits(row)}
                        >
                          <PriceChangeIcon fontSize='small' />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('members.revoke_access')}>
                        <IconButton
                          size='small'
                          color='error'
                          aria-label={t('members.revoke_access')}
                          onClick={() => onRevokeAccess(row)}
                        >
                          <LogoutIcon fontSize='small' />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  )
}

function RoleBadge({ row }: { row: TeamRow }) {
  const { t } = useTranslation('team')
  if (row.is_owner) {
    return <Badge variant='brand'>{t('members.owner_label')}</Badge>
  }
  if (row.preset_applied === 'manager') {
    return <Badge variant='info'>{t('members.preset_manager')}</Badge>
  }
  if (row.preset_applied === 'salesperson') {
    return <Badge variant='neutral'>{t('members.preset_salesperson')}</Badge>
  }
  return (
    <Box sx={{ display: 'inline-block' }}>
      <Badge variant='neutral'>{t('members.preset_custom')}</Badge>
    </Box>
  )
}

export default TeamMembersTable
