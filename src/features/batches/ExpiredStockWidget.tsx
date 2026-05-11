import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useNavigate } from 'react-router'
import { Badge, Button, Card } from 'src/components/ui'
import { paths } from 'src/paths'
import { useAlreadyExpired } from './hooks'
import BulkWriteOffDialog from './BulkWriteOffDialog'

/**
 * v2.8.3 dashboard widget — surfaces batches past expiry with
 * qty_remaining > 0. Sits below the v2.8 expiring-soon alerts widget;
 * uses danger-tone styling to distinguish "you missed the prevention
 * window" from "you're approaching it."
 *
 * Hides entirely when no expired-with-stock batches exist (per the
 * v2.8 "no celebratory empty state" rule).
 */
export default function ExpiredStockWidget() {
  const { t } = useTranslation(['dashboard', 'batches', 'common'])
  const navigate = useNavigate()
  const expired = useAlreadyExpired(50)
  const [bulkOpen, setBulkOpen] = useState(false)

  const rows = expired.data ?? []
  if (rows.length === 0) return null

  return (
    <Card
      sx={{
        flex: 1,
        minWidth: 320,
        borderLeft: '4px solid var(--status-error-text)'
      }}
    >
      <Stack spacing={1.5}>
        <Stack
          direction='row'
          alignItems='center'
          justifyContent='space-between'
        >
          <Stack direction='row' spacing={1} alignItems='center'>
            <ReportProblemOutlinedIcon
              fontSize='small'
              sx={{ color: 'var(--status-error-text)' }}
            />
            <Typography variant='h3'>
              {t('dashboard:expired_stock.title')}
            </Typography>
          </Stack>
          <Badge
            variant='error'
            label={t('dashboard:expired_stock.count', { count: rows.length })}
          />
        </Stack>

        <Divider sx={{ borderColor: 'var(--border-subtle)' }} />

        <Stack spacing={0.75}>
          {rows.slice(0, 5).map((row) => (
            <Stack
              key={row.batch_id ?? ''}
              direction='row'
              spacing={0.75}
              alignItems='baseline'
              sx={{
                flexWrap: 'wrap',
                cursor: 'pointer',
                p: 0.75,
                borderRadius: 'var(--radius-sm)',
                '&:hover': { backgroundColor: 'var(--surface-muted)' }
              }}
              onClick={() =>
                row.product_id && navigate(paths.gotoProduct(row.product_id))
              }
            >
              <Typography variant='body2' sx={{ fontWeight: 500 }}>
                {row.product_name}
              </Typography>
              <Typography
                variant='caption'
                sx={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}
              >
                {row.batch_no}
              </Typography>
              <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
                ({row.qty_remaining})
              </Typography>
              <Typography
                variant='caption'
                sx={{
                  color: 'var(--status-error-text)',
                  fontWeight: 600
                }}
              >
                {t('dashboard:expired_stock.expired_days_ago', {
                  count: row.days_since_expired ?? 0
                })}
              </Typography>
            </Stack>
          ))}
        </Stack>

        <Stack
          direction='row'
          spacing={1}
          justifyContent='space-between'
          alignItems='center'
        >
          {rows.length > 5 ? (
            <Button
              component={RouterLink}
              to={paths.expiredInventory}
              variant='ghost'
              size='sm'
            >
              {t('dashboard:expired_stock.view_all')}
            </Button>
          ) : (
            <Box />
          )}
          <Button
            variant='secondary'
            size='sm'
            onClick={() => setBulkOpen(true)}
          >
            {t('dashboard:expired_stock.write_off_all')}
          </Button>
        </Stack>
      </Stack>

      {bulkOpen && (
        <BulkWriteOffDialog
          batches={rows.map((r) => ({
            batch_id: r.batch_id ?? '',
            batch_no: r.batch_no ?? '',
            qty_remaining: r.qty_remaining ?? 0,
            product_name: r.product_name ?? ''
          }))}
          onClose={() => setBulkOpen(false)}
        />
      )}
    </Card>
  )
}
