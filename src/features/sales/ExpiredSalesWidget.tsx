import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import HistoryEduOutlinedIcon from '@mui/icons-material/HistoryEduOutlined'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useNavigate } from 'react-router'
import { Badge, Button, Card } from 'src/components/ui'
import { usePermission } from 'src/lib/permissions'
import { paths } from 'src/paths'
import { useExpiredSales } from './hooks'

/**
 * v2.8.4 dashboard widget — surfaces sale_items rows in the last 30 days
 * that were drawn from expired batches. Read-only spot-check view; no
 * mutating actions. Hides entirely when the count is zero.
 */
export default function ExpiredSalesWidget() {
  const { t, i18n } = useTranslation(['dashboard', 'common'])
  // v2.9.1: matches the /inventory/expired-sales route gate (view_all_sales +
  // view_inventory_batches). Hide entirely if either is missing — salesperson
  // sees no other staff's expired sales.
  const canViewAllSales = usePermission('view_all_sales')
  const canViewInventoryBatches = usePermission('view_inventory_batches')
  const navigate = useNavigate()
  const expired = useExpiredSales(50)
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'

  const rows = expired.data ?? []
  if (!canViewAllSales || !canViewInventoryBatches) return null
  if (rows.length === 0) return null

  const fmtDate = (iso: string) =>
    iso
      ? new Intl.DateTimeFormat(locale, {
          month: 'short',
          day: 'numeric'
        }).format(new Date(iso))
      : ''

  return (
    <Card
      sx={{
        flex: 1,
        minWidth: 320,
        borderLeft: '4px solid var(--status-warning-text)'
      }}
    >
      <Stack spacing={1.5}>
        <Stack
          direction='row'
          alignItems='center'
          justifyContent='space-between'
        >
          <Stack direction='row' spacing={1} alignItems='center'>
            <HistoryEduOutlinedIcon
              fontSize='small'
              sx={{ color: 'var(--status-warning-text)' }}
            />
            <Typography variant='h3'>
              {t('dashboard:expired_sales_widget.title')}
            </Typography>
          </Stack>
          <Badge variant='warning' label={String(rows.length)} />
        </Stack>

        <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
          {t('dashboard:expired_sales_widget.summary', { count: rows.length })}
        </Typography>

        <Divider sx={{ borderColor: 'var(--border-subtle)' }} />

        <Stack spacing={0.75}>
          {rows.slice(0, 5).map((row) => (
            <Stack
              key={row.sale_item_id}
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
              onClick={() => navigate(paths.gotoSale(row.invoice_id))}
            >
              <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
                {fmtDate(row.invoice_created_at)}
              </Typography>
              <Typography variant='body2' sx={{ fontWeight: 500 }}>
                {row.product_name}
              </Typography>
              <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
                {t('dashboard:expired_sales_widget.row_units', {
                  count: row.qty
                })}
              </Typography>
              {row.days_expired_at_sale !== null && (
                <Typography
                  variant='caption'
                  sx={{
                    color: 'var(--status-warning-text)',
                    fontWeight: 600
                  }}
                >
                  {t('dashboard:expired_sales_widget.row_expired_days', {
                    count: row.days_expired_at_sale
                  })}
                </Typography>
              )}
            </Stack>
          ))}
        </Stack>

        {rows.length > 5 && (
          <Stack direction='row' justifyContent='flex-start'>
            <Button
              component={RouterLink}
              to={paths.expiredSales}
              variant='ghost'
              size='sm'
            >
              {t('dashboard:expired_sales_widget.view_all')}
            </Button>
          </Stack>
        )}
      </Stack>
    </Card>
  )
}
