import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { paths } from 'src/paths'
import { Button } from 'src/components/ui'
import { PageHeader } from 'src/components/layout'
import ProductTable, { type StockDisplayMode } from './ProductTable'
import CategoryFilter from './CategoryFilter'

const STOCK_DISPLAY_KEY = 'nizaamify.products.stock_display_mode'

function readStoredMode(): StockDisplayMode {
  if (typeof window === 'undefined') return 'base'
  const v = window.localStorage.getItem(STOCK_DISPLAY_KEY)
  return v === 'compact' || v === 'compound' ? v : 'base'
}

export default function ProductsListPage() {
  const { t } = useTranslation(['products', 'common', 'units'])
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [stockMode, setStockMode] = useState<StockDisplayMode>(() =>
    readStoredMode()
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STOCK_DISPLAY_KEY, stockMode)
  }, [stockMode])

  const categoryId = params.get('category_id')
  const handleCategoryChange = (next: string | null) => {
    const updated = new URLSearchParams(params)
    if (next) updated.set('category_id', next)
    else updated.delete('category_id')
    // Drop the page param so filter changes don't strand the user on page 5
    updated.delete('page')
    setParams(updated, { replace: true })
  }

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', width: '100%' }}>
      <PageHeader
        title={t('products:title')}
        actions={
          <Stack direction='row' spacing={1.5} alignItems='center'>
            <CategoryFilter
              value={categoryId}
              onChange={handleCategoryChange}
            />
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

      {/* v2.5 §3: drop the Actions column. The eye icon + row click are the
          only per-row affordances; edit moved to the detail page. */}
      <ProductTable
        showAvgCost
        showLastPurchase
        showCategoryColumn
        showViewIcon
        onView={(row) => navigate(paths.gotoProduct(row.id))}
        stockDisplayMode={stockMode}
        categoryId={categoryId}
      />
    </Box>
  )
}
