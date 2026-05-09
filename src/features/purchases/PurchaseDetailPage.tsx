import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { paths } from 'src/paths'
import { usePurchase } from './hooks'
import { formatPKR } from 'src/features/subscription/env'
import {
  Banner,
  Button,
  Card,
  DataTable,
  FullPageSpinner,
  type DataTableColumn
} from 'src/components/ui'

type PurchaseItem = {
  id: string
  qty: number
  cost_at_purchase: number | string
  product?: {
    name?: string
    avg_cost?: number
    last_purchase_cost?: number | string | null
  } | null
}

export default function PurchaseDetailPage() {
  const { t, i18n } = useTranslation(['purchases', 'common'])
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  const { data: purchase, isLoading, error } = usePurchase(id)

  if (isLoading) return <FullPageSpinner />

  if (error || !purchase) {
    return (
      <Box sx={{ maxWidth: 1024, mx: 'auto', width: '100%' }}>
        <Banner variant='error'>{t('purchases:errors.not_found')}</Banner>
        <Button
          variant='secondary'
          onClick={() => navigate(paths.purchases)}
          sx={{ mt: 2 }}
        >
          {t('purchases:actions.back')}
        </Button>
      </Box>
    )
  }

  const items = purchase.items as PurchaseItem[]
  const totalQty = items.reduce((s, it) => s + it.qty, 0)
  const itemsTotal = items.reduce(
    (s, it) => s + it.qty * Number(it.cost_at_purchase),
    0
  )
  const totalsMismatch =
    Math.abs(itemsTotal - Number(purchase.total_cost)) > 0.01

  const shortId = purchase.id.slice(0, 8)

  const itemColumns: DataTableColumn<PurchaseItem>[] = [
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
      id: 'cost_at_purchase',
      header: t('purchases:detail.cost_at_purchase'),
      align: 'end',
      cell: (it) => formatPKR(it.cost_at_purchase, locale)
    },
    {
      id: 'line_total',
      header: t('purchases:fields.total'),
      align: 'end',
      cell: (it) => formatPKR(it.qty * Number(it.cost_at_purchase), locale)
    }
  ]

  const inventoryColumns: DataTableColumn<PurchaseItem>[] = [
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
      cell: () => t('purchases:detail.not_available')
    },
    {
      id: 'avg_after',
      header: t('purchases:detail.avg_after'),
      align: 'end',
      cell: (it) => {
        const product = it.product
        const isMostRecent =
          product?.last_purchase_cost !== undefined &&
          product?.last_purchase_cost !== null &&
          Math.abs(
            Number(product.last_purchase_cost) - Number(it.cost_at_purchase)
          ) < 0.01
        return isMostRecent && product?.avg_cost !== undefined
          ? formatPKR(product.avg_cost, locale)
          : t('purchases:detail.not_available')
      }
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
              {t('purchases:list.date')}
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
              {t('purchases:list.source')}
            </Typography>
            <Typography variant='body1'>{purchase.source ?? '—'}</Typography>
          </Box>
          <Box>
            <Typography variant='overline' sx={{ color: 'var(--text-muted)' }}>
              {t('purchases:list.total')}
            </Typography>
            <Typography variant='body1' sx={{ fontWeight: 600 }}>
              {formatPKR(purchase.total_cost, locale)}
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

      <Card sx={{ mb: 2 }} noPadding>
        <Box sx={{ p: 2, borderBottom: '1px solid var(--border-subtle)' }}>
          <Typography variant='h3'>{t('purchases:fields.product')}</Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          <DataTable
            columns={itemColumns}
            rows={items}
            getRowId={(it) => it.id}
            ariaLabel={t('purchases:fields.product')}
          />
        </Box>
        <Stack
          direction='row'
          justifyContent='space-between'
          alignItems='center'
          sx={{
            p: 2,
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--surface-subtle)'
          }}
        >
          <Typography variant='body1' sx={{ fontWeight: 600 }}>
            {t('purchases:fields.total')}
          </Typography>
          <Stack direction='row' spacing={4}>
            <Typography variant='body1' sx={{ fontWeight: 600 }}>
              {totalQty}
            </Typography>
            <Typography variant='body1' sx={{ fontWeight: 600 }}>
              {formatPKR(itemsTotal, locale)}
            </Typography>
          </Stack>
        </Stack>
        {totalsMismatch && (
          <Box sx={{ p: 2 }}>
            <Banner variant='warning'>
              {t('purchases:detail.totals_mismatch')}
            </Banner>
          </Box>
        )}
      </Card>

      <Card noPadding>
        <Box sx={{ p: 2, borderBottom: '1px solid var(--border-subtle)' }}>
          <Typography variant='h3'>
            {t('purchases:detail.effect_on_inventory')}
          </Typography>
          <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
            {t('purchases:detail.effect_caveat')}
          </Typography>
        </Box>
        <Box sx={{ p: 2 }}>
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
