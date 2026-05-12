import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { Banner, Button, Dialog } from 'src/components/ui'

export type ExpiredSaleConfirmRow = {
  productLabel: string
  qty: number
}

type Props = {
  open: boolean
  onClose: () => void
  rows: ExpiredSaleConfirmRow[]
  submitting?: boolean
  onConfirm: () => void
}

/** v2.8.4: shown when at least one cart line has policy='warn' AND the
 *  preflight reports `would_draw_expired = true` (and there's no policy=
 *  'block' line blocking the whole sale). Confirming forwards
 *  `confirm_expired_sale = true` to record_sale. */
export default function ConfirmExpiredSaleDialog({
  open,
  onClose,
  rows,
  submitting,
  onConfirm
}: Props) {
  const { t } = useTranslation(['pos', 'common'])

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!submitting) onClose()
      }}
      maxWidth='sm'
      title={t('pos:expired_sale.warn_dialog_title')}
      actions={
        <>
          <Button variant='ghost' onClick={onClose} disabled={!!submitting}>
            {t('pos:expired_sale.warn_dialog_cancel')}
          </Button>
          <Button variant='primary' onClick={onConfirm} loading={!!submitting}>
            {t('pos:expired_sale.warn_dialog_continue')}
          </Button>
        </>
      }
    >
      <Stack spacing={1.5}>
        <Banner variant='warning'>
          {t('pos:expired_sale.warn_dialog_body')}
        </Banner>
        <Stack spacing={0.5} component='ul' sx={{ pl: 2.5, m: 0 }}>
          {rows.map((r, i) => (
            <Typography
              key={`${i}-${r.productLabel}`}
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
