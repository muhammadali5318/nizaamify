import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import EditIcon from '@mui/icons-material/Edit'
import ArchiveIcon from '@mui/icons-material/Archive'
import AddIcon from '@mui/icons-material/Add'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Tooltip
} from 'src/components/ui'
import { PageHeader } from 'src/components/layout'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import {
  useAttributeValues,
  useVariantAttributes,
  useCreateVariantAttribute,
  useUpdateVariantAttribute,
  useDeactivateVariantAttribute,
  useAddVariantValue,
  useUpdateVariantValue,
  useDeactivateVariantValue,
  variantAttributeErrorKey,
  type VariantAttribute,
  type VariantAttributeValue
} from './hooks'
import VariantAttributeDialog from './VariantAttributeDialog'
import VariantValueDialog from './VariantValueDialog'

export default function VariantAttributesPage() {
  const { t } = useTranslation(['variant_attributes', 'common'])
  const notify = useNotifier()
  const { data: attributes = [], isLoading } = useVariantAttributes()

  const createAttr = useCreateVariantAttribute()
  const updateAttr = useUpdateVariantAttribute()
  const archiveAttr = useDeactivateVariantAttribute()
  const addValue = useAddVariantValue()
  const updateValue = useUpdateVariantValue()
  const archiveValue = useDeactivateVariantValue()

  const [attrDialog, setAttrDialog] = useState<
    { kind: 'create' } | { kind: 'edit'; attr: VariantAttribute } | null
  >(null)
  const [valueDialog, setValueDialog] = useState<
    | { kind: 'create'; attr: VariantAttribute }
    | { kind: 'edit'; attr: VariantAttribute; value: VariantAttributeValue }
    | null
  >(null)
  const [confirmArchiveAttr, setConfirmArchiveAttr] =
    useState<VariantAttribute | null>(null)
  const [confirmArchiveValue, setConfirmArchiveValue] = useState<{
    attr: VariantAttribute
    value: VariantAttributeValue
  } | null>(null)
  const [errorText, setErrorText] = useState<string | null>(null)

  const handleAttrSubmit = async (input: {
    name: string
    display_order: number
  }) => {
    setErrorText(null)
    try {
      if (attrDialog?.kind === 'create') {
        await createAttr.mutateAsync(input)
        notify.success(t('variant_attributes:messages.attribute_saved'))
      } else if (attrDialog?.kind === 'edit') {
        await updateAttr.mutateAsync({
          id: attrDialog.attr.id,
          name: input.name,
          display_order: input.display_order
        })
        notify.success(t('variant_attributes:messages.attribute_saved'))
      }
      setAttrDialog(null)
    } catch (err) {
      const key = variantAttributeErrorKey(err)
      setErrorText(key ? t(key) : t('variant_attributes:errors.save_failed'))
    }
  }

  const handleValueSubmit = async (input: {
    value: string
    display_order: number
  }) => {
    setErrorText(null)
    try {
      if (valueDialog?.kind === 'create') {
        await addValue.mutateAsync({
          attribute_id: valueDialog.attr.id,
          value: input.value,
          display_order: input.display_order
        })
        notify.success(t('variant_attributes:messages.value_saved'))
      } else if (valueDialog?.kind === 'edit') {
        await updateValue.mutateAsync({
          id: valueDialog.value.id,
          value: input.value,
          display_order: input.display_order
        })
        notify.success(t('variant_attributes:messages.value_saved'))
      }
      setValueDialog(null)
    } catch (err) {
      const key = variantAttributeErrorKey(err)
      setErrorText(key ? t(key) : t('variant_attributes:errors.save_failed'))
    }
  }

  const handleArchiveAttr = async () => {
    if (!confirmArchiveAttr) return
    try {
      await archiveAttr.mutateAsync(confirmArchiveAttr.id)
      notify.success(t('variant_attributes:messages.attribute_archived'))
      setConfirmArchiveAttr(null)
    } catch (err) {
      const key = variantAttributeErrorKey(err)
      notify.error(key ? t(key) : t('variant_attributes:errors.save_failed'))
    }
  }

  const handleArchiveValue = async () => {
    if (!confirmArchiveValue) return
    try {
      await archiveValue.mutateAsync(confirmArchiveValue.value.id)
      notify.success(t('variant_attributes:messages.value_archived'))
      setConfirmArchiveValue(null)
    } catch (err) {
      const key = variantAttributeErrorKey(err)
      notify.error(key ? t(key) : t('variant_attributes:errors.save_failed'))
    }
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', width: '100%' }}>
      <PageHeader
        title={t('variant_attributes:title')}
        subtitle={t('variant_attributes:subtitle')}
        actions={
          <Button
            variant='primary'
            startIcon={<AddIcon />}
            onClick={() => {
              setErrorText(null)
              setAttrDialog({ kind: 'create' })
            }}
          >
            {t('variant_attributes:new_attribute')}
          </Button>
        }
      />

      {/* Help banner: variant attribute is NOT a category. */}
      <Box sx={{ mb: 2 }}>
        <Banner variant='info'>
          {t('variant_attributes:what_is_an_attribute')}
        </Banner>
      </Box>

      {isLoading ? (
        <Card>
          <EmptyState title={t('common:loading')} />
        </Card>
      ) : attributes.length === 0 ? (
        <Card>
          <Stack spacing={1.5} alignItems='center' sx={{ py: 3 }}>
            <Typography variant='body1' sx={{ color: 'var(--text-muted)' }}>
              {t('variant_attributes:empty_state')}
            </Typography>
            <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
              {t('variant_attributes:examples')}
            </Typography>
            <Button
              variant='primary'
              startIcon={<AddIcon />}
              onClick={() => setAttrDialog({ kind: 'create' })}
            >
              {t('variant_attributes:new_attribute')}
            </Button>
          </Stack>
        </Card>
      ) : (
        <Stack spacing={2}>
          {attributes.map((attr) => (
            <AttributeCard
              key={attr.id}
              attribute={attr}
              onEdit={() => {
                setErrorText(null)
                setAttrDialog({ kind: 'edit', attr })
              }}
              onArchive={() => setConfirmArchiveAttr(attr)}
              onAddValue={() => {
                setErrorText(null)
                setValueDialog({ kind: 'create', attr })
              }}
              onEditValue={(value) => {
                setErrorText(null)
                setValueDialog({ kind: 'edit', attr, value })
              }}
              onArchiveValue={(value) =>
                setConfirmArchiveValue({ attr, value })
              }
            />
          ))}
        </Stack>
      )}

      <VariantAttributeDialog
        open={attrDialog !== null}
        mode={attrDialog?.kind === 'edit' ? 'edit' : 'create'}
        initialName={attrDialog?.kind === 'edit' ? attrDialog.attr.name : ''}
        initialDisplayOrder={
          attrDialog?.kind === 'edit' ? attrDialog.attr.display_order : 0
        }
        submitting={createAttr.isPending || updateAttr.isPending}
        errorText={errorText}
        onClose={() => setAttrDialog(null)}
        onSubmit={handleAttrSubmit}
      />

      <VariantValueDialog
        open={valueDialog !== null}
        mode={valueDialog?.kind === 'edit' ? 'edit' : 'create'}
        attributeName={valueDialog?.attr.name ?? ''}
        initialValue={
          valueDialog?.kind === 'edit' ? valueDialog.value.value : ''
        }
        initialDisplayOrder={
          valueDialog?.kind === 'edit' ? valueDialog.value.display_order : 0
        }
        submitting={addValue.isPending || updateValue.isPending}
        errorText={errorText}
        onClose={() => setValueDialog(null)}
        onSubmit={handleValueSubmit}
      />

      <ConfirmDialog
        open={confirmArchiveAttr !== null}
        onClose={() => setConfirmArchiveAttr(null)}
        onConfirm={handleArchiveAttr}
        title={t('variant_attributes:dialog.confirm_archive_attribute_title')}
        description={t(
          'variant_attributes:dialog.confirm_archive_attribute_body'
        )}
        confirmLabel={t('variant_attributes:actions.archive')}
        cancelLabel={t('variant_attributes:actions.cancel')}
        loading={archiveAttr.isPending}
        destructive
      />

      <ConfirmDialog
        open={confirmArchiveValue !== null}
        onClose={() => setConfirmArchiveValue(null)}
        onConfirm={handleArchiveValue}
        title={t('variant_attributes:dialog.confirm_archive_value_title')}
        description={t('variant_attributes:dialog.confirm_archive_value_body')}
        confirmLabel={t('variant_attributes:actions.archive')}
        cancelLabel={t('variant_attributes:actions.cancel')}
        loading={archiveValue.isPending}
        destructive
      />
    </Box>
  )
}

type AttributeCardProps = {
  attribute: VariantAttribute
  onEdit: () => void
  onArchive: () => void
  onAddValue: () => void
  onEditValue: (value: VariantAttributeValue) => void
  onArchiveValue: (value: VariantAttributeValue) => void
}

function AttributeCard({
  attribute,
  onEdit,
  onArchive,
  onAddValue,
  onEditValue,
  onArchiveValue
}: AttributeCardProps) {
  const { t } = useTranslation(['variant_attributes', 'common'])
  const { data: values = [], isLoading } = useAttributeValues(attribute.id)

  return (
    <Card>
      <Stack spacing={1.5}>
        <Stack
          direction='row'
          spacing={1}
          alignItems='center'
          justifyContent='space-between'
        >
          <Stack direction='row' spacing={1} alignItems='center'>
            <Typography variant='h6' sx={{ fontWeight: 600 }}>
              {attribute.name}
            </Typography>
            <Badge
              variant='neutral'
              label={t('variant_attributes:values_count', {
                count: attribute.value_count
              })}
            />
          </Stack>
          <Stack direction='row' spacing={0.5}>
            <Tooltip title={t('common:actions.edit')}>
              <IconButton size='small' onClick={onEdit}>
                <EditIcon fontSize='small' />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('variant_attributes:actions.archive')}>
              <IconButton size='small' onClick={onArchive}>
                <ArchiveIcon fontSize='small' />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
        <Divider sx={{ borderColor: 'var(--border-subtle)' }} />
        {isLoading ? (
          <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
            {t('common:loading')}
          </Typography>
        ) : values.length === 0 ? (
          <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
            {t('variant_attributes:empty_state_values')}
          </Typography>
        ) : (
          <Stack direction='row' spacing={0.75} flexWrap='wrap' useFlexGap>
            {values.map((v) => (
              <ValuePill
                key={v.id}
                value={v}
                onEdit={() => onEditValue(v)}
                onArchive={() => onArchiveValue(v)}
              />
            ))}
          </Stack>
        )}
        <Box>
          <Button
            variant='secondary'
            size='sm'
            startIcon={<AddIcon />}
            onClick={onAddValue}
          >
            {t('variant_attributes:actions.add_value')}
          </Button>
        </Box>
      </Stack>
    </Card>
  )
}

function ValuePill({
  value,
  onEdit,
  onArchive
}: {
  value: VariantAttributeValue
  onEdit: () => void
  onArchive: () => void
}) {
  const { t } = useTranslation(['variant_attributes', 'common'])
  return (
    <Stack
      direction='row'
      spacing={0.5}
      alignItems='center'
      sx={{
        backgroundColor: 'var(--surface-muted)',
        borderRadius: 'var(--radius-md)',
        px: 1.25,
        py: 0.5
      }}
    >
      <Typography variant='body2'>{value.value}</Typography>
      <Tooltip title={t('common:actions.edit')}>
        <IconButton size='small' onClick={onEdit} sx={{ p: 0.25 }}>
          <EditIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title={t('variant_attributes:actions.archive')}>
        <IconButton size='small' onClick={onArchive} sx={{ p: 0.25 }}>
          <ArchiveIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </Stack>
  )
}
