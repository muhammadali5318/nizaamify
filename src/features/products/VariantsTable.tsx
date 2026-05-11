import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
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
import { useProductVariants, type ProductVariantRow } from './hooks'
import VariantEditDialog from './VariantEditDialog'
import AddVariantDialog from './AddVariantDialog'

type Props = {
  productId: string
}

export default function VariantsTable({ productId }: Props) {
  const { t, i18n } = useTranslation(['variants', 'common', 'products'])
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  const { data: variants = [], isLoading } = useProductVariants(productId)
  const [editVariant, setEditVariant] = useState<ProductVariantRow | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const columns: DataTableColumn<ProductVariantRow>[] = [
    {
      id: 'variant',
      header: t('variants:columns.variant'),
      cardRole: 'heading',
      cell: (row) => (
        <Stack direction='row' spacing={0.75} alignItems='center'>
          <Typography variant='body1' sx={{ fontWeight: 500 }}>
            {row.variant_label ?? '—'}
          </Typography>
          {!row.variant_is_active && (
            <Badge variant='neutral' label={t('products:actions.archive')} />
          )}
        </Stack>
      )
    },
    {
      id: 'price',
      header: t('variants:columns.price'),
      align: 'end',
      cell: (row) =>
        row.price === null ? '—' : formatPKR(Number(row.price), locale)
    },
    {
      id: 'stock',
      header: t('variants:columns.stock'),
      align: 'end',
      cell: (row) => <Typography variant='body2'>{row.stock}</Typography>
    },
    {
      id: 'avg_cost',
      header: t('products:fields.avg_cost'),
      align: 'end',
      hideOnMobile: true,
      cell: (row) => (
        <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
          {formatPKR(Number(row.avg_cost ?? 0), locale)}
        </Typography>
      )
    },
    {
      id: 'last_purchase',
      header: t('products:fields.last_purchase_cost'),
      align: 'end',
      hideOnMobile: true,
      cell: (row) => (
        <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
          {row.last_purchase_cost === null
            ? '—'
            : formatPKR(Number(row.last_purchase_cost), locale)}
        </Typography>
      )
    },
    {
      id: 'action',
      header: '',
      align: 'end',
      width: 56,
      cardRole: 'actions',
      cell: (row) => (
        <Tooltip title={t('common:actions.edit')}>
          <IconButton
            size='small'
            onClick={() => setEditVariant(row)}
            aria-label={t('common:actions.edit')}
          >
            <EditIcon fontSize='small' />
          </IconButton>
        </Tooltip>
      )
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
            {t('variants:title')}
          </Typography>
          <Button
            variant='secondary'
            size='sm'
            startIcon={<AddIcon />}
            onClick={() => setAddOpen(true)}
          >
            {t('variants:actions.add_variant')}
          </Button>
        </Stack>
        <Divider sx={{ borderColor: 'var(--border-subtle)' }} />
        <DataTable
          columns={columns}
          rows={variants}
          getRowId={(row) => row.variant_id}
          loading={isLoading}
          ariaLabel={t('variants:title')}
          empty={
            <Box sx={{ py: 3 }}>
              <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
                {t('variants:variants_count', { count: 0 })}
              </Typography>
            </Box>
          }
        />
      </Stack>

      <VariantEditDialog
        open={editVariant !== null}
        variant={editVariant}
        onClose={() => setEditVariant(null)}
      />

      <AddVariantDialog
        open={addOpen}
        productId={productId}
        existingVariants={variants}
        onClose={() => setAddOpen(false)}
      />
    </Card>
  )
}
