import { useState } from 'react'
import Box from '@mui/material/Box'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Button, EmptyState, Skeleton } from 'src/components/ui'
import { PageHeader } from 'src/components/layout'
import { paths } from 'src/paths'
import { useProduct } from './hooks'
import ProductDetailBody from './ProductDetailBody'
import ProductEditDialog from './ProductEditDialog'

export default function ProductDetailPage() {
  const { t } = useTranslation(['products', 'common'])
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)

  const { data: product, isLoading } = useProduct(id)

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', width: '100%' }}>
      <PageHeader
        title={t('products:detail.title')}
        actions={
          <Button
            variant='ghost'
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(paths.products)}
          >
            {t('products:actions.back')}
          </Button>
        }
      />

      {isLoading ? (
        <Box sx={{ py: 4 }}>
          <Skeleton variant='rect' height={120} />
          <Box sx={{ mt: 2 }}>
            <Skeleton variant='rect' height={240} />
          </Box>
        </Box>
      ) : !product ? (
        <Box sx={{ py: 4 }}>
          <EmptyState title={t('products:detail.not_found')} />
        </Box>
      ) : (
        <>
          <ProductDetailBody
            product={product}
            onEdit={() => setEditOpen(true)}
          />
          <ProductEditDialog
            open={editOpen}
            onClose={() => setEditOpen(false)}
            product={product}
          />
        </>
      )}
    </Box>
  )
}
