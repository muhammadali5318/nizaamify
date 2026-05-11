import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { paths } from 'src/paths'
import {
  Banner,
  Button,
  Card,
  DataTable,
  EmptyState,
  type DataTableColumn
} from 'src/components/ui'
import { formatPKR } from 'src/features/subscription/env'
import {
  usePurchaseDetail,
  type PurchaseDetailItem,
  type PurchaseDetailOverhead
} from './hooks'

export default function PurchaseDetailPage() {
  const { t, i18n } = useTranslation(['purchases', 'common'])
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  const navigate = useNavigate()
  const { id } = useParams()
  const { data: purchase, isLoading } = usePurchaseDetail(id)

  if (isLoading) {
    return (
      <Box sx={{ maxWidth: 1024, mx: 'auto', width: '100%' }}>
        <EmptyState title={t('common:loading')} />
      </Box>
    )
  }

  if (!purchase) {
    return (
      <Box sx={{ maxWidth: 1024, mx: 'auto', width: '100%' }}>
        <EmptyState title={t('purchases:errors.not_found')} />
      </Box>
    )
  }

  const items = purchase.items ?? []
  const overhead = purchase.overhead ?? []
  const shortId = purchase.id.slice(0, 8)
  const hasSnapshots = items.some(
    (it) => it.avg_cost_before !== null || it.avg_cost_after !== null
  )

  // DataTable's cell signature is (row) → ReactNode (no index), so we
  // precompute the row number per row id. Fixes the v2.3 NaN bug.
  const itemSerialById = new Map(items.map((it, i) => [it.id, i + 1]))
  const overheadSerialById = new Map(overhead.map((o, i) => [o.id, i + 1]))

  // v2.6c: line_subtotal + line_overhead come from purchase_item_financials
  // (server-computed). Frontend reads, never computes. The view encodes the
  // v2.3 largest-remainder result + the v1.x legacy fallback in one column.

  const itemColumns: DataTableColumn<PurchaseDetailItem>[] = [
    {
      id: 'serial',
      header: '#',
      width: 40,
      cell: (it) => (
        <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
          {itemSerialById.get(it.id) ?? ''}
        </Typography>
      )
    },
    {
      id: 'product',
      header: t('purchases:fields.product'),
      cardRole: 'heading',
      cell: (it) => it.product?.name ?? t('purchases:detail.deleted_product')
    },
    {
      id: 'qty',
      header: t('purchases:fields.qty'),
      align: 'end',
      cell: (it) => {
        if (it.pack_qty !== null && it.pack && it.pack_base_qty_snapshot) {
          return (
            <Stack alignItems='flex-end'>
              <span>{`${it.pack_qty} × ${it.pack.unit_name}${it.pack.is_active ? '' : ' 🗄'}`}</span>
              <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
                {`(= ${it.qty_in_base})`}
              </Typography>
            </Stack>
          )
        }
        return it.qty
      }
    },
    {
      id: 'unit_cost',
      header: t('purchases:fields.cost'),
      align: 'end',
      cell: (it) => formatPKR(Number(it.cost_at_purchase), locale)
    },
    {
      id: 'subtotal',
      header: t('purchases:detail.line_subtotal'),
      align: 'end',
      cell: (it) => formatPKR(Number(it.line_subtotal), locale)
    },
    {
      id: 'overhead',
      header: t('purchases:detail.line_overhead'),
      align: 'end',
      hideOnMobile: true,
      cell: (it) => {
        const v = Number(it.line_overhead)
        return v > 0 ? formatPKR(v, locale) : '—'
      }
    },
    {
      id: 'line_total',
      header: t('purchases:fields.total'),
      align: 'end',
      cell: (it) => formatPKR(Number(it.line_total), locale)
    }
  ]

  const inventoryColumns: DataTableColumn<PurchaseDetailItem>[] = [
    {
      id: 'product',
      header: t('purchases:fields.product'),
      cardRole: 'heading',
      cell: (it) => it.product?.name ?? t('purchases:detail.deleted_product')
    },
    {
      id: 'avg_before',
      header: t('purchases:detail.avg_before'),
      align: 'end',
      cell: (it) =>
        it.avg_cost_before === null
          ? t('purchases:detail.not_available')
          : formatPKR(Number(it.avg_cost_before), locale)
    },
    {
      id: 'avg_after',
      header: t('purchases:detail.avg_after'),
      align: 'end',
      cell: (it) =>
        it.avg_cost_after === null
          ? t('purchases:detail.not_available')
          : formatPKR(Number(it.avg_cost_after), locale)
    },
    {
      id: 'cost_change',
      header: t('purchases:detail.cost_change'),
      align: 'end',
      cell: (it) => {
        if (it.cost_delta === null) {
          return t('purchases:detail.not_available')
        }
        // v2.6c: cost_delta is server-computed (avg_cost_after − avg_cost_before)
        // from purchase_item_financials. No JS money arithmetic.
        const delta = Number(it.cost_delta)
        const sign = delta > 0 ? '+' : ''
        const color =
          delta > 0
            ? 'var(--status-warning-text)'
            : delta < 0
              ? 'var(--status-success-text)'
              : 'var(--text-muted)'
        return (
          <Typography variant='body2' sx={{ color, fontWeight: 600 }}>
            {sign}
            {formatPKR(delta, locale)}
          </Typography>
        )
      }
    }
  ]

  const overheadColumns: DataTableColumn<PurchaseDetailOverhead>[] = [
    {
      id: 'serial',
      header: '#',
      width: 40,
      cell: (o) => (
        <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
          {overheadSerialById.get(o.id) ?? ''}
        </Typography>
      )
    },
    {
      id: 'category',
      header: t('purchases:fields.category'),
      cardRole: 'heading',
      cell: (o) => t(`purchases:form.category.${o.category}`)
    },
    {
      id: 'description',
      header: t('purchases:fields.description'),
      cell: (o) => o.description ?? '—'
    },
    {
      id: 'amount',
      header: t('purchases:fields.amount'),
      align: 'end',
      cell: (o) => formatPKR(Number(o.amount), locale)
    }
  ]

  return (
    <Box sx={{ maxWidth: 1024, mx: 'auto', width: '100%' }}>
      <Button
        variant='ghost'
        onClick={() => navigate(paths.purchases)}
        sx={{ mb: 1 }}
      >
        {t('purchases:actions.back')}
      </Button>

      <Card sx={{ mb: 2 }}>
        <Typography variant='display' component='h1'>
          {t('purchases:detail.title', { shortId })}
        </Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={3}
          mt={2}
          flexWrap='wrap'
          rowGap={2}
        >
          <Box>
            <Typography variant='overline' sx={{ color: 'var(--text-muted)' }}>
              {t('purchases:list.columns.date')}
            </Typography>
            <Typography variant='body1'>
              {new Intl.DateTimeFormat(locale, {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              }).format(new Date(purchase.purchase_date))}
            </Typography>
          </Box>
          <Box>
            <Typography variant='overline' sx={{ color: 'var(--text-muted)' }}>
              {t('purchases:list.columns.supplier')}
            </Typography>
            <Typography variant='body1'>
              {purchase.supplier_name ?? purchase.source ?? '—'}
            </Typography>
          </Box>
          <Box>
            <Typography variant='overline' sx={{ color: 'var(--text-muted)' }}>
              {t('purchases:detail.recorded_by')}
            </Typography>
            <Typography variant='body1'>
              {purchase.cashier_email ?? '—'}
            </Typography>
          </Box>
        </Stack>
        {purchase.note && (
          <Box mt={2}>
            <Typography variant='overline' sx={{ color: 'var(--text-muted)' }}>
              {t('purchases:fields.note')}
            </Typography>
            <Typography variant='body2'>{purchase.note}</Typography>
          </Box>
        )}
      </Card>

      {/* Items */}
      <Card sx={{ mb: 2 }} noPadding>
        <Box sx={{ p: 2, borderBottom: '1px solid var(--border-subtle)' }}>
          <Typography variant='h3'>{t('purchases:detail.items')}</Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          {Number(purchase.overhead_subtotal) > 0 && (
            <Banner variant='info' sx={{ mb: 2 }}>
              {t('purchases:detail.overhead_distribution_note')}
            </Banner>
          )}
          <DataTable
            columns={itemColumns}
            rows={items}
            getRowId={(it) => it.id}
            ariaLabel={t('purchases:detail.items')}
          />
        </Box>
        <Stack
          direction='row'
          justifyContent='space-between'
          sx={{
            p: 2,
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--surface-subtle)'
          }}
        >
          <Typography variant='body1' sx={{ fontWeight: 600 }}>
            {t('purchases:form.items_subtotal')}
          </Typography>
          <Typography variant='body1' sx={{ fontWeight: 600 }}>
            {formatPKR(Number(purchase.items_subtotal), locale)}
          </Typography>
        </Stack>
      </Card>

      {/* Additional costs */}
      {overhead.length > 0 && (
        <Card sx={{ mb: 2 }} noPadding>
          <Box sx={{ p: 2, borderBottom: '1px solid var(--border-subtle)' }}>
            <Typography variant='h3'>
              {t('purchases:detail.additional_costs')}
            </Typography>
          </Box>
          <Box sx={{ p: 2 }}>
            <DataTable
              columns={overheadColumns}
              rows={overhead}
              getRowId={(o) => o.id}
              ariaLabel={t('purchases:detail.additional_costs')}
            />
          </Box>
          <Stack
            direction='row'
            justifyContent='space-between'
            sx={{
              p: 2,
              borderTop: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--surface-subtle)'
            }}
          >
            <Typography variant='body1' sx={{ fontWeight: 600 }}>
              {t('purchases:form.overhead_subtotal')}
            </Typography>
            <Typography variant='body1' sx={{ fontWeight: 600 }}>
              {formatPKR(Number(purchase.overhead_subtotal), locale)}
            </Typography>
          </Stack>
        </Card>
      )}

      {/* Grand total */}
      <Card sx={{ mb: 2 }}>
        <Typography variant='h3' sx={{ mb: 2 }}>
          {t('purchases:form.grand_total')}
        </Typography>
        <Stack spacing={1}>
          <Stack direction='row' justifyContent='space-between'>
            <Typography variant='body2'>
              {t('purchases:form.items_subtotal')}
            </Typography>
            <Typography variant='body2'>
              {formatPKR(Number(purchase.items_subtotal), locale)}
            </Typography>
          </Stack>
          <Stack direction='row' justifyContent='space-between'>
            <Typography variant='body2'>
              {t('purchases:form.overhead_subtotal')}
            </Typography>
            <Typography variant='body2'>
              {formatPKR(Number(purchase.overhead_subtotal), locale)}
            </Typography>
          </Stack>
          <Stack
            direction='row'
            justifyContent='space-between'
            sx={{
              pt: 1,
              borderTop: '1px solid var(--border-subtle)'
            }}
          >
            <Typography variant='body1' sx={{ fontWeight: 700 }}>
              {t('purchases:form.grand_total')}
            </Typography>
            <Typography variant='body1' sx={{ fontWeight: 700 }}>
              {formatPKR(Number(purchase.total_cost), locale)}
            </Typography>
          </Stack>
        </Stack>
      </Card>

      {/* Effect on inventory */}
      <Card sx={{ mb: 2 }} noPadding>
        <Box sx={{ p: 2, borderBottom: '1px solid var(--border-subtle)' }}>
          <Typography variant='h3'>
            {t('purchases:detail.effect_on_inventory')}
          </Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          {!hasSnapshots && (
            <Banner variant='info' sx={{ mb: 2 }}>
              {t('purchases:detail.no_snapshot_help')}
            </Banner>
          )}
          <DataTable
            columns={inventoryColumns}
            rows={items}
            getRowId={(it) => it.id}
            ariaLabel={t('purchases:detail.effect_on_inventory')}
          />
        </Box>
      </Card>
    </Box>
  )
}
