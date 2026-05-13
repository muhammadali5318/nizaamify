import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { useTranslation } from 'react-i18next'
import { Badge, Card } from 'src/components/ui'
import { usePermission } from 'src/lib/permissions'
import {
  useExpiringSoon,
  useHasAnyBatchedProduct,
  useWarrantyExpiringSoon
} from './hooks'

/**
 * v2.8 dashboard widget — surfaces from batches_expiring_soon and
 * batches_warranty_expiring_soon. Hides itself entirely when no batched
 * product exists in the shop (don't pollute the dashboard with empty
 * states for shops that don't use this feature).
 */
export default function InventoryAlertsWidget() {
  const { t } = useTranslation(['dashboard', 'batches', 'common'])
  // v2.9.1: catalog permission gate. Hide entirely if user lacks
  // view_inventory_batches — same surface-level rule as the /inventory/expired
  // route. Hook stays at top of body per React's rule-of-hooks.
  const canViewInventoryBatches = usePermission('view_inventory_batches')
  const hasAnyBatched = useHasAnyBatchedProduct()
  const expiring = useExpiringSoon(10)
  const warranty = useWarrantyExpiringSoon(10)

  if (!canViewInventoryBatches) return null
  if (!hasAnyBatched.data) return null

  const expCount = expiring.data?.length ?? 0
  const warCount = warranty.data?.length ?? 0
  const anyAlerts = expCount + warCount > 0

  return (
    <Card sx={{ flex: 1, minWidth: 320 }}>
      <Stack spacing={1.5}>
        <Stack
          direction='row'
          alignItems='center'
          justifyContent='space-between'
        >
          <Typography variant='h3'>
            {t('dashboard:inventory_alerts.title')}
          </Typography>
        </Stack>

        {!anyAlerts && (
          <Stack direction='row' spacing={1} alignItems='center'>
            <CheckCircleOutlineIcon
              sx={{ color: 'var(--status-success-text)' }}
              fontSize='small'
            />
            <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
              {t('dashboard:inventory_alerts.no_alerts')}
            </Typography>
          </Stack>
        )}

        {expCount > 0 && (
          <Box>
            <Stack
              direction='row'
              spacing={1}
              alignItems='center'
              sx={{ mb: 0.5 }}
            >
              <WarningAmberIcon
                fontSize='small'
                sx={{ color: 'var(--status-warning-text)' }}
              />
              <Typography variant='body2' sx={{ fontWeight: 600 }}>
                {t('dashboard:inventory_alerts.expiring_soon')}
              </Typography>
              <Badge
                variant='warning'
                label={t('dashboard:inventory_alerts.expiring_soon_count', {
                  count: expCount
                })}
              />
            </Stack>
            <Stack spacing={0.5}>
              {(expiring.data ?? []).slice(0, 4).map((row) => (
                <Stack
                  key={row.batch_id ?? ''}
                  direction='row'
                  spacing={0.75}
                  alignItems='baseline'
                  sx={{ flexWrap: 'wrap' }}
                >
                  <Typography variant='body2' sx={{ fontWeight: 500 }}>
                    {row.product_name}
                  </Typography>
                  <Typography
                    variant='caption'
                    sx={{
                      color: 'var(--text-muted)',
                      fontFamily: 'monospace'
                    }}
                  >
                    {row.batch_no}
                  </Typography>
                  <Typography
                    variant='caption'
                    sx={{ color: 'var(--text-muted)' }}
                  >
                    ({row.qty_remaining})
                  </Typography>
                  <Typography
                    variant='caption'
                    sx={{
                      color: 'var(--status-warning-text)',
                      fontWeight: 600
                    }}
                  >
                    {t('dashboard:inventory_alerts.expires_in_days', {
                      count: row.days_until_expiry ?? 0
                    })}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        )}

        {warCount > 0 && (
          <>
            <Divider sx={{ borderColor: 'var(--border-subtle)' }} />
            <Box>
              <Stack
                direction='row'
                spacing={1}
                alignItems='center'
                sx={{ mb: 0.5 }}
              >
                <WarningAmberIcon
                  fontSize='small'
                  sx={{ color: 'var(--status-info-text)' }}
                />
                <Typography variant='body2' sx={{ fontWeight: 600 }}>
                  {t('dashboard:inventory_alerts.warranty_expiring')}
                </Typography>
                <Badge
                  variant='info'
                  label={t(
                    'dashboard:inventory_alerts.warranty_expiring_count',
                    {
                      count: warCount
                    }
                  )}
                />
              </Stack>
              <Stack spacing={0.5}>
                {(warranty.data ?? []).slice(0, 4).map((row) => (
                  <Stack
                    key={row.batch_id ?? ''}
                    direction='row'
                    spacing={0.75}
                    alignItems='baseline'
                    sx={{ flexWrap: 'wrap' }}
                  >
                    <Typography variant='body2' sx={{ fontWeight: 500 }}>
                      {row.product_name}
                    </Typography>
                    <Typography
                      variant='caption'
                      sx={{
                        color: 'var(--text-muted)',
                        fontFamily: 'monospace'
                      }}
                    >
                      {row.batch_no}
                    </Typography>
                    {row.supplier_name && (
                      <Typography
                        variant='caption'
                        sx={{ color: 'var(--text-muted)' }}
                      >
                        · {row.supplier_name}
                      </Typography>
                    )}
                    <Typography
                      variant='caption'
                      sx={{
                        color: 'var(--status-info-text)',
                        fontWeight: 600
                      }}
                    >
                      {t('dashboard:inventory_alerts.warranty_ends_in_days', {
                        count: row.days_until_warranty_expires ?? 0
                      })}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </>
        )}
      </Stack>
    </Card>
  )
}
