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

  const itemColumns: DataTableColumn<PurchaseDetailItem>[] = [
    {
      id: 'serial',
      header: '#',
      width: 40,
      cell: (_p, idx) => (
        <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
          {idx + 1}
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
      cell: (it) => it.qty
    },
    {
      id: 'unit_cost',
      header: t('purchases:fields.cost'),
      align: 'end',
      cell: (it) => formatPKR(Number(it.cost_at_purchase), locale)
    },
    {
      id: 'overhead_per_unit',
      header: t('purchases:detail.overhead_per_unit'),
      align: 'end',
      hideOnMobile: true,
      cell: (it) =>
        Number(it.overhead_per_unit) > 0
          ? formatPKR(Number(it.overhead_per_unit), locale)
          : '—'
    },
    {
      id: 'effective_cost',
      header: t('purchases:detail.effective_cost'),
      align: 'end',
      hideOnMobile: true,
      cell: (it) =>
        formatPKR(
          Number(it.cost_at_purchase) + Number(it.overhead_per_unit),
          locale
        )
    },
    {
      id: 'line_total',
      header: t('purchases:fields.total'),
      align: 'end',
      cell: (it) => formatPKR(it.qty * Number(it.cost_at_purchase), locale)
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
      id: 'delta',
      header: t('purchases:detail.delta'),
      align: 'end',
      cell: (it) => {
        if (it.avg_cost_before === null || it.avg_cost_after === null) {
          return t('purchases:detail.not_available')
        }
        const delta = Number(it.avg_cost_after) - Number(it.avg_cost_before)
        const sign = delta > 0 ? '+' : ''
        const color =
          delta > 0
            ? 'var(--warning-700)'
            : delta < 0
              ? 'var(--success-700)'
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
      cell: (_p, idx) => (
        <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
          {idx + 1}
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
