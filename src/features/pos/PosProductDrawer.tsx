import { useState } from 'react'
import Box from '@mui/material/Box'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { useTranslation } from 'react-i18next'
import { Button, Drawer, Skeleton } from 'src/components/ui'
import { useProduct } from 'src/features/products/hooks'
import ProductDetailBody from 'src/features/products/ProductDetailBody'
import ProductEditDialog from 'src/features/products/ProductEditDialog'

type Props = {
  productId: string | null
  onClose: () => void
  /** Called when "+ Add to cart" is pressed in the footer. Drawer is closed
   * after the parent confirms add (or always — caller's choice). */
  onAddToCart: (productId: string) => void
}

/**
 * Side-panel drawer (bottom-sheet on mobile) shown when the cashier clicks
 * a product row or its eye icon in the POS picker (v2.5 §1.3).
 *
 * Slides in from the left on desktop — sits adjacent to the persistent
 * app sidebar, leaving the cart on the right untouched. Cart state lives
 * in POSPage and is independent of this drawer; opening, editing, or
 * closing here never touches the cart.
 */
export default function PosProductDrawer({
  productId,
  onClose,
  onAddToCart
}: Props) {
  const { t } = useTranslation(['products', 'pos', 'common'])
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [editOpen, setEditOpen] = useState(false)

  const { data: product, isLoading } = useProduct(productId ?? undefined)
  const open = productId !== null

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        anchor={isMobile ? 'bottom' : 'left'}
        title={t('products:detail.title')}
        slotProps={{
          paper: {
            sx: isMobile
              ? undefined
              : {
                  width: 560,
                  maxWidth: '100vw',
                  borderRadius: 0,
                  backgroundColor: 'var(--surface-base)',
                  display: 'flex',
                  flexDirection: 'column'
                }
          }
        }}
      >
        <Box sx={{ p: 2, pb: 10 /* leave room for sticky footer */ }}>
          {isLoading ? (
            <Box>
              <Skeleton variant='rect' height={120} />
              <Box sx={{ mt: 2 }}>
                <Skeleton variant='rect' height={240} />
              </Box>
            </Box>
          ) : product ? (
            <ProductDetailBody
              product={product}
              onEdit={() => setEditOpen(true)}
              showPacksSection={false}
            />
          ) : null}
        </Box>

        {product && (
          <Box
            sx={{
              position: 'sticky',
              bottom: 0,
              insetInline: 0,
              borderTop: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--surface-base)',
              p: 2,
              display: 'flex',
              justifyContent: 'flex-end'
            }}
          >
            <Button
              variant='primary'
              size='lg'
              disabled={product.stock <= 0}
              onClick={() => {
                onAddToCart(product.id)
                onClose()
              }}
            >
              {t('products:detail.add_to_cart')}
            </Button>
          </Box>
        )}
      </Drawer>

      <ProductEditDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        product={product}
      />
    </>
  )
}
