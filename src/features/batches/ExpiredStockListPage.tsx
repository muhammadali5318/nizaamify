import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  Tooltip,
  type DataTableColumn
} from 'src/components/ui'
import { PageHeader } from 'src/components/layout'
import { useAlreadyExpired, type AlreadyExpiredBatchRow } from './hooks'
import WriteOffBatchDialog from './WriteOffBatchDialog'
import BulkWriteOffDialog from './BulkWriteOffDialog'

/**
 * v2.8.3 — full list view for already-expired batches, linked from the
 * dashboard widget's "View all" affordance. Same data, no truncation,
 * per-row write-off + bulk write-off both available.
 */
export default function ExpiredStockListPage() {
  const { t, i18n } = useTranslation(['dashboard', 'batches', 'common'])
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  const navigate = useNavigate()
  const { data = [], isLoading } = useAlreadyExpired(500)
  const [writeOff, setWriteOff] = useState<AlreadyExpiredBatchRow | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)

  const fmtDate = (s: string | null) =>
    s
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
          new Date(s)
        )
      : '—'

  const columns: DataTableColumn<AlreadyExpiredBatchRow>[] = useMemo(
    () => [
      {
        id: 'product',
        header: t('common:nav.products', { defaultValue: 'Product' }),
        cardRole: 'heading',
        cell: (r) => r.product_name ?? '—'
      },
      {
        id: 'batch_no',
        header: t('batches:fields.batch_no'),
        cell: (r) => (
          <Typography variant='body2' sx={{ fontFamily: 'monospace' }}>
            {r.batch_no ?? '—'}
          </Typography>
        )
      },
      {
        id: 'expiry_date',
        header: t('batches:fields.expiry_date'),
        cell: (r) => fmtDate(r.expiry_date)
      },
      {
        id: 'days',
        header: t('dashboard:expired_stock.title'),
        cell: (r) => (
          <Typography
            variant='body2'
            sx={{ color: 'var(--status-error-text)', fontWeight: 600 }}
          >
            {t('dashboard:expired_stock.expired_days_ago', {
              count: r.days_since_expired ?? 0
            })}
          </Typography>
        )
      },
      {
        id: 'qty',
        header: t('batches:fields.qty_remaining'),
        align: 'end',
        cell: (r) => r.qty_remaining ?? 0
      },
      {
        id: 'action',
        header: '',
        align: 'end',
        width: 56,
        cardRole: 'actions',
        cell: (r) => (
          <Tooltip title={t('batches:actions.write_off')}>
            <IconButton
              size='small'
              onClick={(e) => {
                e.stopPropagation()
                setWriteOff(r)
              }}
              aria-label={t('batches:actions.write_off')}
            >
              <DeleteOutlineIcon fontSize='small' />
            </IconButton>
          </Tooltip>
        )
      }
    ],
    [t, locale]
  )

  return (
    <Box sx={{ maxWidth: 1024, mx: 'auto', width: '100%' }}>
      <PageHeader title={t('dashboard:expired_stock.list_title')} />

      <Card>
        <Stack spacing={1.5}>
          {data.length > 0 && (
            <Stack direction='row' justifyContent='flex-end'>
              <Button
                variant='secondary'
                size='sm'
                onClick={() => setBulkOpen(true)}
              >
                {t('dashboard:expired_stock.write_off_all')}
              </Button>
            </Stack>
          )}

          <DataTable
            columns={columns}
            rows={data}
            getRowId={(r) => r.batch_id ?? ''}
            loading={isLoading}
            onRowClick={(r) =>
              r.product_id && navigate(paths.gotoProduct(r.product_id))
            }
            ariaLabel={t('dashboard:expired_stock.list_title')}
            empty={
              <Box sx={{ py: 4 }}>
                <EmptyState title={t('dashboard:expired_stock.list_empty')} />
              </Box>
            }
          />
        </Stack>
      </Card>

      {writeOff && (
        <WriteOffBatchDialog
          batchId={writeOff.batch_id ?? ''}
          batchNo={writeOff.batch_no ?? ''}
          qtyRemaining={writeOff.qty_remaining ?? 0}
          productName={writeOff.product_name ?? ''}
          onClose={() => setWriteOff(null)}
        />
      )}

      {bulkOpen && (
        <BulkWriteOffDialog
          batches={data.map((r) => ({
            batch_id: r.batch_id ?? '',
            batch_no: r.batch_no ?? '',
            qty_remaining: r.qty_remaining ?? 0,
            product_name: r.product_name ?? ''
          }))}
          onClose={() => setBulkOpen(false)}
        />
      )}
    </Box>
  )
}
