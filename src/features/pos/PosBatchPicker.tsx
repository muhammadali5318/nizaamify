import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { Badge, Banner, Button, Dialog, Spinner } from 'src/components/ui'
import { useActiveBatchesForVariant } from 'src/features/batches/hooks'

type Props = {
  open: boolean
  onClose: () => void
  /** Resolved default variant id for single-variant cart lines; the
   *  variant.id for multi-variant cart lines. Both come from the cart
   *  line's `resolved_variant_id` field. */
  variantId: string | null
  productName: string
  /** Currently picked batch_id (if any) — highlighted in the list. */
  currentBatchId: string | null
  /** Min qty required for the line — batches below this are dimmed. */
  requiredQty: number
  /** Picks the batch and closes; caller dispatches set_batch on the cart. */
  onPick: (batch: {
    batch_id: string
    batch_no: string
    batch_expiry_date: string | null
  }) => void
  /** Clears the manual override and re-enables FEFO. */
  onResetToFefo: () => void
}

/**
 * v2.8.5 — Cart-line batch picker. Lists active batches FEFO-ordered with
 * stock, expiry, and an EXPIRED badge on past-expiry rows. Clicking a row
 * sets the cart line's `batch_id`. The "Reset to FEFO" action clears the
 * override and lets `record_sale` walk its own FEFO list.
 *
 * Backend gating: `record_sale` + `preflight_expired_sale_check` enforce
 * the shop/per-product `expired_sale_policy` against the picked batch
 * (block raises; warn requires confirmation; allow flags `sold_expired`).
 * The picker doesn't gate selection — it surfaces the choice and lets the
 * preflight dialog do the final ask.
 */
export default function PosBatchPicker({
  open,
  onClose,
  variantId,
  productName,
  currentBatchId,
  requiredQty,
  onPick,
  onResetToFefo
}: Props) {
  const { t, i18n } = useTranslation(['pos', 'batches', 'common'])
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  const { data: batches = [], isLoading } = useActiveBatchesForVariant(
    open ? variantId : null
  )

  const fmtDate = (s: string | null) =>
    s
      ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
          new Date(s)
        )
      : '—'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isExpired = (s: string | null) => {
    if (!s) return false
    const d = new Date(s)
    d.setHours(0, 0, 0, 0)
    return d < today
  }

  // v2.8.5 — when no manual override is active, surface which batch the
  // server-side auto-pick (FEFO) would actually draw from so the shop
  // owner sees the default without needing to know the term. Priority:
  // first non-expired batch with enough stock; fall back to first
  // expired batch with enough stock (allow-policy clearance flow).
  // batches are already sorted expiry ASC + received_at ASC by the hook.
  const autoPickBatchId = useMemo(() => {
    if (currentBatchId) return null
    const fits = batches.filter((b) => b.qty_remaining >= requiredQty)
    const nonExpired = fits.find((b) => !isExpired(b.expiry_date))
    if (nonExpired) return nonExpired.id
    const anyExpired = fits.find((b) => isExpired(b.expiry_date))
    return anyExpired?.id ?? null
  }, [batches, currentBatchId, requiredQty])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='sm'
      title={t('batches:batch_picker_title', { productName })}
      actions={
        <>
          <Button
            variant='ghost'
            onClick={() => {
              onResetToFefo()
              onClose()
            }}
            disabled={!currentBatchId}
          >
            {t('batches:indicators.reset_to_fefo')}
          </Button>
          <Button variant='secondary' onClick={onClose}>
            {t('common:actions.cancel')}
          </Button>
        </>
      }
    >
      {/* v2.8.5: shop-owner-friendly explanation of what auto-pick does,
       *  shown only when no manual override is active (the user might
       *  not even realize there *is* a default). */}
      {!currentBatchId && batches.length > 0 && (
        <Box sx={{ mb: 1.5 }}>
          <Banner variant='info'>{t('pos:cart.batch_auto_hint')}</Banner>
        </Box>
      )}

      {isLoading ? (
        <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
          <Spinner size='inline' />
        </Box>
      ) : batches.length === 0 ? (
        // Empty state — no active batches with stock at all.
        // (The auto-pick banner above is hidden in this branch too.)
        <Typography variant='body2' sx={{ color: 'var(--text-muted)', py: 2 }}>
          {t('batches:errors.no_batch_stock_available')}
        </Typography>
      ) : (
        <Stack spacing={1}>
          {batches.map((b) => {
            const expired = isExpired(b.expiry_date)
            const insufficient = b.qty_remaining < requiredQty
            const selected = currentBatchId === b.id
            // v2.8.5: badge the row that auto-pick would draw from when
            // there's no manual override. Doesn't change selection — just
            // surfaces the default.
            const isAutoPick = !selected && b.id === autoPickBatchId
            return (
              <Box
                key={b.id}
                onClick={() => {
                  if (insufficient) return
                  onPick({
                    batch_id: b.id,
                    batch_no: b.batch_no,
                    batch_expiry_date: b.expiry_date
                  })
                  onClose()
                }}
                sx={{
                  p: 1.5,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid',
                  borderColor: selected
                    ? 'var(--text-brand)'
                    : isAutoPick
                      ? 'var(--text-brand)'
                      : 'var(--border-subtle)',
                  backgroundColor: selected
                    ? 'var(--status-brand-bg)'
                    : 'transparent',
                  cursor: insufficient ? 'not-allowed' : 'pointer',
                  opacity: insufficient ? 0.5 : 1,
                  '&:hover': {
                    backgroundColor: insufficient
                      ? undefined
                      : selected
                        ? 'var(--status-brand-bg)'
                        : 'var(--surface-muted)'
                  }
                }}
              >
                <Stack spacing={0.75}>
                  {/* Row 1: batch_no + status badges (wraps freely). */}
                  <Stack
                    direction='row'
                    spacing={0.75}
                    alignItems='center'
                    flexWrap='wrap'
                    rowGap={0.5}
                  >
                    <Typography
                      variant='body2'
                      sx={{
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        wordBreak: 'break-all'
                      }}
                    >
                      {b.batch_no}
                    </Typography>
                    {expired && (
                      <Badge
                        variant='error'
                        label={t('pos:cart.batch_expired_label')}
                      />
                    )}
                    {selected && (
                      <Badge
                        variant='brand'
                        label={t('batches:indicators.selected')}
                      />
                    )}
                    {isAutoPick && (
                      <Badge
                        variant='brand'
                        label={t('pos:cart.batch_next_up')}
                      />
                    )}
                  </Stack>

                  {/* Row 2: meta line — Expiry · Qty. Single row, wraps if
                      the dialog is narrow. */}
                  <Stack
                    direction='row'
                    spacing={1.5}
                    alignItems='baseline'
                    flexWrap='wrap'
                    rowGap={0.25}
                    sx={{ color: 'var(--text-muted)' }}
                  >
                    <Typography variant='caption'>
                      {t('batches:fields.expiry_date')}:{' '}
                      <span style={{ color: 'var(--text-primary)' }}>
                        {fmtDate(b.expiry_date)}
                      </span>
                    </Typography>
                    <Typography variant='caption'>
                      {t('batches:fields.qty_remaining')}:{' '}
                      <Typography
                        component='span'
                        variant='caption'
                        sx={{
                          color: insufficient
                            ? 'var(--status-error-text)'
                            : 'var(--text-primary)',
                          fontWeight: 600
                        }}
                      >
                        {b.qty_remaining}
                      </Typography>
                    </Typography>
                  </Stack>

                  {/* Row 3: full-width insufficient-stock hint. Renders
                      only when the picked-or-hovered batch can't satisfy
                      the cart line. */}
                  {insufficient && (
                    <Typography
                      variant='caption'
                      sx={{
                        display: 'block',
                        color: 'var(--status-error-text)',
                        backgroundColor: 'var(--status-error-bg)',
                        borderRadius: 'var(--radius-sm)',
                        px: 1,
                        py: 0.5,
                        lineHeight: 1.4
                      }}
                    >
                      {t('batches:errors.selected_batch_insufficient_long', {
                        available: b.qty_remaining,
                        needed: requiredQty
                      })}
                    </Typography>
                  )}
                </Stack>
              </Box>
            )
          })}
        </Stack>
      )}
    </Dialog>
  )
}
