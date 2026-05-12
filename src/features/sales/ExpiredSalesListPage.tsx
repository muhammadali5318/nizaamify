import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import {
  Card,
  DataTable,
  EmptyState,
  type DataTableColumn
} from 'src/components/ui'
import { PageHeader } from 'src/components/layout'
import { useExpiredSales, type ExpiredSaleRow } from './hooks'

/**
 * v2.8.4 — historical audit page for sales that drew from expired stock.
 * Linked from the dashboard widget's "View all" affordance. Read-only;
 * snapshot truth from `sale_items.sold_expired`.
 */
export default function ExpiredSalesListPage() {
  const { t, i18n } = useTranslation(['dashboard', 'common', 'sales'])
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  const navigate = useNavigate()
  const { data = [], isLoading } = useExpiredSales(500)

  const fmtDate = (s: string) =>
    s
      ? new Intl.DateTimeFormat(locale, {
          dateStyle: 'medium'
        }).format(new Date(s))
      : '—'

  const columns: DataTableColumn<ExpiredSaleRow>[] = useMemo(
    () => [
      {
        id: 'date',
        header: t('dashboard:expired_sales_widget.col_date'),
        cardRole: 'heading',
        cell: (r) => fmtDate(r.invoice_created_at)
      },
      {
        id: 'invoice',
        header: t('dashboard:expired_sales_widget.col_invoice'),
        cell: (r) => (
          <Typography variant='body2' sx={{ fontFamily: 'monospace' }}>
            #{r.invoice_id.slice(0, 8)}
          </Typography>
        )
      },
      {
        id: 'product',
        header: t('dashboard:expired_sales_widget.col_product'),
        cell: (r) => r.product_name || '—'
      },
      {
        id: 'qty',
        header: t('dashboard:expired_sales_widget.col_qty'),
        align: 'end',
        cell: (r) => r.qty
      },
      {
        id: 'days_expired',
        header: t('dashboard:expired_sales_widget.col_days_expired'),
        align: 'end',
        cell: (r) =>
          r.days_expired_at_sale === null ? (
            '—'
          ) : (
            <Typography
              variant='body2'
              sx={{
                color: 'var(--status-warning-text)',
                fontWeight: 600
              }}
            >
              {r.days_expired_at_sale}
            </Typography>
          )
      }
    ],
    [t, locale]
  )

  return (
    <Box sx={{ maxWidth: 1024, mx: 'auto', width: '100%' }}>
      <PageHeader
        title={t('dashboard:expired_sales_widget.page_title')}
        subtitle={t('dashboard:expired_sales_widget.page_subtitle')}
      />

      <Card>
        <Stack spacing={1.5}>
          <DataTable
            columns={columns}
            rows={data}
            getRowId={(r) => r.sale_item_id}
            loading={isLoading}
            onRowClick={(r) => navigate(paths.gotoSale(r.invoice_id))}
            ariaLabel={t('dashboard:expired_sales_widget.page_title')}
            empty={
              <Box sx={{ py: 4 }}>
                <EmptyState title={t('dashboard:expired_sales_widget.empty')} />
              </Box>
            }
          />
        </Stack>
      </Card>
    </Box>
  )
}
