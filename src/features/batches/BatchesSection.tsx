import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Divider from '@mui/material/Divider'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  Button,
  Card,
  DataTable,
  Tooltip,
  type DataTableColumn
} from 'src/components/ui'
import { formatPKR } from 'src/features/subscription/env'
import { usePermission } from 'src/lib/permissions'
import { useAllBatchesForVariant } from './hooks'
import WriteOffBatchDialog from './WriteOffBatchDialog'

type Props = {
  variantId: string
  productName?: string
}

type Row = {
  id: string
  batch_no: string
  qty_received: number
  qty_remaining: number
  cost_per_unit: number
  manufactured_date: string | null
  expiry_date: string | null
  warranty_expires_at: string | null
  supplier_warranty_days: number | null
  received_at: string
  is_active: boolean
}

export default function BatchesSection({ variantId, productName }: Props) {
  const { t, i18n } = useTranslation(['batches', 'common'])
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  // v2.9.1: per-batch cost_per_unit gates on view_batch_cost. Owner+manager
  // have it; salesperson does not. HOOKS ORDER: top.
  const canViewBatchCost = usePermission('view_batch_cost')
  const { data = [], isLoading } = useAllBatchesForVariant(variantId)
  const [showInactive, setShowInactive] = useState(false)
  const [writeOff, setWriteOff] = useState<Row | null>(null)

  const rows = useMemo<Row[]>(
    () =>
      (data as Row[])
        .map((r) => ({
          id: r.id,
          batch_no: r.batch_no,
          qty_received: r.qty_received,
          qty_remaining: r.qty_remaining,
          cost_per_unit: Number(r.cost_per_unit),
          manufactured_date: r.manufactured_date,
          expiry_date: r.expiry_date,
          warranty_expires_at: r.warranty_expires_at,
          supplier_warranty_days: r.supplier_warranty_days,
          received_at: r.received_at,
          is_active: r.is_active
        }))
        .filter((r) => (showInactive ? true : r.is_active)),
    [data, showInactive]
  )

  const activeCount = (data as Row[]).filter((r) => r.is_active).length
  const inactiveCount = (data as Row[]).length - activeCount

  const fmtDate = (s: string | null) =>
    s
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
          new Date(s)
        )
      : '—'

  const columns: DataTableColumn<Row>[] = [
    {
      id: 'batch_no',
      header: t('batches:fields.batch_no'),
      cardRole: 'heading',
      cell: (r) => (
        <Stack direction='row' spacing={0.75} alignItems='center'>
          <Typography variant='body2' sx={{ fontFamily: 'monospace' }}>
            {r.batch_no}
          </Typography>
          {!r.is_active && (
            <Badge variant='neutral' label={t('common:actions.delete')} />
          )}
        </Stack>
      )
    },
    {
      id: 'received_at',
      header: t('batches:fields.received_at'),
      cell: (r) => fmtDate(r.received_at)
    },
    {
      id: 'expiry_date',
      header: t('batches:fields.expiry_date'),
      cell: (r) => fmtDate(r.expiry_date)
    },
    {
      id: 'warranty_expires_at',
      header: t('batches:fields.warranty_expires_at'),
      hideOnMobile: true,
      cell: (r) => fmtDate(r.warranty_expires_at)
    },
    {
      id: 'qty',
      header: t('batches:fields.qty_remaining'),
      align: 'end',
      cell: (r) => (
        <Typography variant='body2'>
          {r.qty_remaining} / {r.qty_received}
        </Typography>
      )
    },
    ...(canViewBatchCost
      ? [
          {
            id: 'cost',
            header: t('batches:fields.cost_per_unit'),
            align: 'end' as const,
            hideOnMobile: true,
            cell: (r: Row) => formatPKR(r.cost_per_unit, locale)
          }
        ]
      : []),
    {
      id: 'action',
      header: '',
      align: 'end',
      width: 56,
      cardRole: 'actions',
      cell: (r) =>
        r.is_active ? (
          <Tooltip title={t('batches:actions.write_off')}>
            <IconButton
              size='small'
              onClick={() => setWriteOff(r)}
              aria-label={t('batches:actions.write_off')}
            >
              <DeleteOutlineIcon fontSize='small' />
            </IconButton>
          </Tooltip>
        ) : null
    }
  ]

  return (
    <Card>
      <Stack spacing={1.5}>
        <Stack
          direction='row'
          alignItems='center'
          justifyContent='space-between'
        >
          <Typography variant='overline' sx={{ color: 'var(--text-muted)' }}>
            {t('batches:title')}
          </Typography>
          <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
            {t('batches:indicators.active_batches_count', {
              count: activeCount
            })}
            {inactiveCount > 0 && (
              <>
                {' · '}
                {t('batches:indicators.inactive_batches_count', {
                  count: inactiveCount
                })}
              </>
            )}
          </Typography>
        </Stack>
        <Divider sx={{ borderColor: 'var(--border-subtle)' }} />

        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(r) => r.id}
          loading={isLoading}
          ariaLabel={t('batches:title')}
          empty={
            <Box sx={{ py: 3 }}>
              <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
                {t('batches:indicators.active_batches_count', { count: 0 })}
              </Typography>
            </Box>
          }
        />

        {inactiveCount > 0 && (
          <Box>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => setShowInactive((s) => !s)}
            >
              {showInactive
                ? t('batches:indicators.hide_inactive')
                : t('batches:indicators.show_inactive')}
            </Button>
          </Box>
        )}
      </Stack>

      {writeOff && (
        <WriteOffBatchDialog
          batchId={writeOff.id}
          batchNo={writeOff.batch_no}
          qtyRemaining={writeOff.qty_remaining}
          productName={productName}
          onClose={() => setWriteOff(null)}
        />
      )}
    </Card>
  )
}
