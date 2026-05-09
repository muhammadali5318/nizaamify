import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
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
import ProductTable from './ProductTable'

export default function ProductsListPage() {
  const { t } = useTranslation(['products', 'common'])
  const navigate = useNavigate()
  const archive = useArchiveProduct()
  const notify = useNotifier()
  const [confirm, setConfirm] = useState<ProductSearchRow | null>(null)

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
          <Button
            variant='primary'
            startIcon={<AddIcon />}
            onClick={() => navigate(paths.newProduct)}
          >
            {t('products:new_product')}
          </Button>
        }
      />

      <ProductTable
        showAvgCost
        showLastPurchase
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
