import { useState } from 'react'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import EditIcon from '@mui/icons-material/Edit'
import ArchiveIcon from '@mui/icons-material/Archive'
import StarIcon from '@mui/icons-material/Star'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  Input,
  Tooltip
} from 'src/components/ui'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import {
  useProductPacks,
  useUpdatePack,
  useDeactivatePack,
  type ProductPack
} from 'src/features/units/hooks'
import CreatePackDialog from 'src/features/purchases/CreatePackDialog'

type Props = {
  productId: string
  productName: string
}

/**
 * Quiet UI for managing a product's packs (spec §5.3). Most users never visit
 * it because inline pack creation at stock-in covers their needs — but it's
 * the place to deactivate or rename packs after the fact.
 */
export default function PacksSection({ productId, productName }: Props) {
  const { t } = useTranslation(['products', 'common'])
  const { data: packs = [], isLoading } = useProductPacks(productId)
  const update = useUpdatePack()
  const deactivate = useDeactivatePack()
  const notify = useNotifier()

  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<ProductPack | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] =
    useState<ProductPack | null>(null)

  const handleDeactivate = async () => {
    if (!confirmDeactivate) return
    try {
      await deactivate.mutateAsync({
        packId: confirmDeactivate.id,
        productId
      })
      notify.success(t('products:packs.deactivated'))
      setConfirmDeactivate(null)
    } catch {
      notify.error(t('products:packs.save_failed'))
    }
  }

  return (
    <Box>
      <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
        {t('products:packs.section_title')}
      </Typography>
      <Typography
        variant='caption'
        sx={{ color: 'var(--text-muted)', display: 'block', mb: 1.5 }}
      >
        {t('products:packs.section_subtitle')}
      </Typography>

      {isLoading ? null : packs.length === 0 ? (
        <Typography
          variant='body2'
          sx={{ color: 'var(--text-muted)', mb: 1.5 }}
        >
          —
        </Typography>
      ) : (
        <Stack
          spacing={1}
          sx={{
            border: '1px solid var(--border-subtle)',
            borderRadius: 1,
            p: 1,
            mb: 1.5
          }}
        >
          {packs.map((p) => (
            <Stack
              key={p.id}
              direction='row'
              alignItems='center'
              spacing={1.5}
              sx={{ py: 0.5 }}
            >
              <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
                <Stack direction='row' spacing={0.75} alignItems='center'>
                  <Typography variant='body1' sx={{ fontWeight: 600 }}>
                    {p.unit_name}
                  </Typography>
                  {p.is_default_purchase && (
                    <Tooltip title={t('products:packs.default_badge')}>
                      <StarIcon
                        sx={{ fontSize: 16, color: 'var(--warning-700)' }}
                      />
                    </Tooltip>
                  )}
                </Stack>
                <Typography
                  variant='caption'
                  sx={{ color: 'var(--text-muted)' }}
                >
                  {`${t('products:packs.columns.contains')}: ${p.base_qty}`}
                </Typography>
              </Box>
              <Tooltip title={t('products:packs.edit')}>
                <IconButton size='small' onClick={() => setEditing(p)}>
                  <EditIcon fontSize='small' />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('products:packs.deactivate')}>
                <IconButton
                  size='small'
                  onClick={() => setConfirmDeactivate(p)}
                >
                  <ArchiveIcon fontSize='small' />
                </IconButton>
              </Tooltip>
            </Stack>
          ))}
        </Stack>
      )}

      <Button variant='secondary' size='sm' onClick={() => setAddOpen(true)}>
        {t('products:packs.add_pack')}
      </Button>

      <CreatePackDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        productId={productId}
        productName={productName}
        onCreated={() => setAddOpen(false)}
      />

      {editing && (
        <EditPackDialog
          pack={editing}
          productId={productId}
          onClose={() => setEditing(null)}
          onSave={async ({ baseQty, isDefaultPurchase }) => {
            try {
              await update.mutateAsync({
                packId: editing.id,
                productId,
                baseQty,
                isDefaultPurchase
              })
              notify.success(t('products:messages.saved'))
              setEditing(null)
            } catch {
              notify.error(t('products:packs.save_failed'))
            }
          }}
          saving={update.isPending}
        />
      )}

      <ConfirmDialog
        open={!!confirmDeactivate}
        onClose={() => setConfirmDeactivate(null)}
        onConfirm={() => void handleDeactivate()}
        title={t('products:packs.deactivate_confirm_title')}
        description={t('products:packs.deactivate_confirm_body')}
        confirmLabel={t('products:packs.deactivate')}
        cancelLabel={t('common:actions.cancel')}
        loading={deactivate.isPending}
        destructive
      />
    </Box>
  )
}

type EditPackDialogProps = {
  pack: ProductPack
  productId: string
  onClose: () => void
  onSave: (values: {
    baseQty: number
    isDefaultPurchase: boolean
  }) => Promise<void>
  saving: boolean
}

function EditPackDialog({
  pack,
  onClose,
  onSave,
  saving
}: EditPackDialogProps) {
  const { t } = useTranslation(['products', 'purchases', 'common'])
  const [baseQty, setBaseQty] = useState(String(pack.base_qty))
  const [isDefault, setIsDefault] = useState(pack.is_default_purchase)
  const [err, setErr] = useState<string | null>(null)

  const submit = () => {
    const n = Number(baseQty)
    if (!Number.isInteger(n) || n <= 1) {
      setErr(t('purchases:form.create_pack_invalid_qty'))
      return
    }
    setErr(null)
    void onSave({ baseQty: n, isDefaultPurchase: isDefault })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth='xs'
      title={pack.unit_name}
      actions={
        <>
          <Button variant='ghost' onClick={onClose} disabled={saving}>
            {t('common:actions.cancel')}
          </Button>
          <Button variant='primary' onClick={submit} loading={saving}>
            {t('common:actions.save')}
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        <Field
          label={t('purchases:form.create_pack_contains')}
          hint={t('purchases:form.create_pack_contains_help')}
          error={err ?? undefined}
        >
          <Input
            type='number'
            inputProps={{ min: 2, step: 1, inputMode: 'numeric' }}
            value={baseQty}
            onChange={(e) => setBaseQty(e.target.value)}
          />
        </Field>
        <FormControlLabel
          control={
            <Checkbox
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
          }
          label={t('purchases:form.create_pack_default')}
        />
        {!pack.is_active && <Badge variant='neutral' label='archived' />}
      </Stack>
    </Dialog>
  )
}
