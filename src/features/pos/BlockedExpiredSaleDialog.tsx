import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { Banner, Button, Dialog } from 'src/components/ui'

export type BlockedExpiredSaleRow = {
  productLabel: string
  qty: number
  productId: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  rows: BlockedExpiredSaleRow[]
  onOpenProduct: (productId: string) => void
}

/** v2.8.4: shown when one or more cart lines have policy='block' AND the
 *  preflight RPC reports `would_draw_expired = true`. Cashier must remove
 *  / fix the offending lines before submitting again. */
export default function BlockedExpiredSaleDialog({
  open,
  onClose,
  rows,
  onOpenProduct
}: Props) {
  const { t } = useTranslation(['pos', 'common'])
  const firstProductId =
    rows.find((r) => r.productId !== null)?.productId ?? null

  const handleOpenProduct = () => {
    if (!firstProductId) {
      console.warn(
        '[v2.8.4 block dialog] Open product clicked but no productId in rows',
        rows
      )
      return
    }
    onOpenProduct(firstProductId)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='sm'
      title={t('pos:expired_sale.block_dialog_title')}
      actions={
        <>
          <Button
            variant='secondary'
            onClick={handleOpenProduct}
            disabled={!firstProductId}
          >
            {t('pos:expired_sale.block_dialog_action_open')}
          </Button>
          <Button variant='primary' onClick={onClose}>
            {t('pos:expired_sale.block_dialog_action_cancel')}
          </Button>
        </>
      }
    >
      <Stack spacing={1.5}>
        <Banner variant='error'>
          {t('pos:expired_sale.block_dialog_writeoff_hint')}
        </Banner>
        <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
          {t('pos:expired_sale.block_dialog_body')}
        </Typography>
        <Stack spacing={0.5} component='ul' sx={{ pl: 2.5, m: 0 }}>
          {rows.map((r, i) => (
            <Typography
              key={`${r.productId ?? 'unknown'}-${i}`}
              component='li'
              variant='body2'
            >
              {r.productLabel}
              {' — '}
              <Typography
                component='span'
                variant='body2'
                sx={{ color: 'var(--text-muted)' }}
              >
                {t('pos:expired_sale.units_summary', { count: r.qty })}
              </Typography>
            </Typography>
          ))}
        </Stack>
      </Stack>
    </Dialog>
  )
}
