import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import ArchiveIcon from '@mui/icons-material/Archive'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import { useArchiveProduct, type ProductSearchRow } from './hooks'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import { Button, ConfirmDialog, Tooltip } from 'src/components/ui'
import { PageHeader } from 'src/components/layout'
import ProductTable, { type StockDisplayMode } from './ProductTable'

const STOCK_DISPLAY_KEY = 'nizaamify.products.stock_display_mode'

function readStoredMode(): StockDisplayMode {
  if (typeof window === 'undefined') return 'base'
  const v = window.localStorage.getItem(STOCK_DISPLAY_KEY)
  return v === 'compact' || v === 'compound' ? v : 'base'
}

export default function ProductsListPage() {
  const { t } = useTranslation(['products', 'common', 'units'])
  const navigate = useNavigate()
  const archive = useArchiveProduct()
  const notify = useNotifier()
  const [confirm, setConfirm] = useState<ProductSearchRow | null>(null)
  const [stockMode, setStockMode] = useState<StockDisplayMode>(() =>
    readStoredMode()
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STOCK_DISPLAY_KEY, stockMode)
  }, [stockMode])

  const onArchive = async () => {
    if (!confirm) return
    try {
      await archive.mutateAsync({ id: confirm.id, isActive: false })
      notify.success(t('products:messages.archived'))
      setConfirm(null)
    } catch {
      notify.error(t('products:errors.save_failed'))
    }
  }

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', width: '100%' }}>
      <PageHeader
        title={t('products:title')}
        actions={
          <Stack direction='row' spacing={1.5} alignItems='center'>
            <Stack direction='row' spacing={0.75} alignItems='center'>
              <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
                {t('units:stock_display.label')}
              </Typography>
              <TextField
                select
                size='small'
                value={stockMode}
                onChange={(e) =>
                  setStockMode(e.target.value as StockDisplayMode)
                }
                sx={{ minWidth: 130 }}
              >
                <MenuItem value='base'>
                  {t('units:stock_display.base')}
                </MenuItem>
                <MenuItem value='compact'>
                  {t('units:stock_display.compact')}
                </MenuItem>
                <MenuItem value='compound'>
                  {t('units:stock_display.compound')}
                </MenuItem>
              </TextField>
            </Stack>
            <Button
              variant='primary'
              startIcon={<AddIcon />}
              onClick={() => navigate(paths.newProduct)}
            >
              {t('products:new_product')}
            </Button>
          </Stack>
        }
      />

      <ProductTable
        showAvgCost
        showLastPurchase
        stockDisplayMode={stockMode}
        renderActions={(row) => (
          <Stack direction='row' spacing={0.5}>
            <Tooltip title={t('products:actions.edit')}>
              <IconButton
                size='small'
                onClick={() => navigate(paths.gotoProduct(row.id))}
                aria-label={t('products:actions.edit')}
              >
                <EditIcon fontSize='small' />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('products:actions.archive')}>
              <IconButton
                size='small'
                onClick={() => setConfirm(row)}
                aria-label={t('products:actions.archive')}
              >
                <ArchiveIcon fontSize='small' />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={onArchive}
        title={t('products:actions.archive')}
        description={confirm?.name}
        confirmLabel={t('products:actions.archive')}
        cancelLabel={t('products:actions.back')}
        loading={archive.isPending}
        destructive
      />
    </Box>
  )
}
