import { useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import ArchiveIcon from '@mui/icons-material/Archive'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import { useArchiveProduct, type ProductSearchRow } from './hooks'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
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
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack
        direction='row'
        alignItems='center'
        justifyContent='space-between'
        mb={2}
        flexWrap='wrap'
        gap={1}
      >
        <Typography variant='h5' fontWeight={700}>
          {t('products:title')}
        </Typography>
        <Button
          variant='contained'
          startIcon={<AddIcon />}
          onClick={() => navigate(paths.newProduct)}
        >
          {t('products:new_product')}
        </Button>
      </Stack>

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

      <Dialog open={!!confirm} onClose={() => setConfirm(null)}>
        <DialogTitle>{t('products:actions.archive')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirm?.name}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)} disabled={archive.isPending}>
            {t('products:actions.back')}
          </Button>
          <Button
            color='warning'
            variant='contained'
            onClick={onArchive}
            disabled={archive.isPending}
          >
            {t('products:actions.archive')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
