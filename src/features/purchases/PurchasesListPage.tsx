import Box from '@mui/material/Box'
import AddIcon from '@mui/icons-material/Add'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import { usePurchases } from './hooks'
import { formatPKR } from 'src/features/subscription/env'
import {
  Button,
  DataTable,
  EmptyState,
  type DataTableColumn
} from 'src/components/ui'
import { PageHeader } from 'src/components/layout'

type PurchaseListRow = {
  id: string
  purchase_date: string
  source: string | null
  total_cost: number
  purchase_items: { qty: number }[]
}

export default function PurchasesListPage() {
  const { t, i18n } = useTranslation(['purchases', 'common'])
  const navigate = useNavigate()
  const { data, isLoading } = usePurchases()
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'

  const rows = (data ?? []) as PurchaseListRow[]

  const columns: DataTableColumn<PurchaseListRow>[] = [
    {
      id: 'date',
      header: t('purchases:list.date'),
      cardRole: 'heading',
      cell: (p) =>
        new Intl.DateTimeFormat(locale, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }).format(new Date(p.purchase_date))
    },
    {
      id: 'source',
      header: t('purchases:list.source'),
      cell: (p) => p.source ?? '—'
    },
    {
      id: 'items',
      header: t('purchases:list.items'),
      align: 'end',
      cell: (p) =>
        (p.purchase_items as unknown as { qty: number }[])?.reduce(
          (s, it) => s + (it?.qty ?? 0),
          0
        ) ?? 0
    },
    {
      id: 'total',
      header: t('purchases:list.total'),
      align: 'end',
      cell: (p) => formatPKR(p.total_cost, locale)
    }
  ]

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', width: '100%' }}>
      <PageHeader
        title={t('purchases:title')}
        subtitle={t('purchases:subtitle')}
        actions={
          <Button
            variant='primary'
            startIcon={<AddIcon />}
            onClick={() => navigate(paths.newPurchase)}
          >
            {t('purchases:add_purchase')}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(p) => p.id}
        loading={isLoading}
        onRowClick={(p) => navigate(paths.gotoPurchase(p.id))}
        empty={
          <Box sx={{ py: 4 }}>
            <EmptyState title={t('purchases:empty')} />
          </Box>
        }
        ariaLabel={t('purchases:title')}
      />
    </Box>
  )
}
