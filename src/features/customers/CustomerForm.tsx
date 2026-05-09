import { useState } from 'react'
import { Alert, Box, Button, Collapse, Stack, TextField } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'

const PK_PHONE_RE = /^(\+92|0)[0-9]{10}$/

export type CustomerFormValues = {
  name: string
  phone: string
  address: string
  notes: string
}

const schema = (t: TFunction) =>
  z.object({
    name: z
      .string()
      .min(2, t('customers:errors.name_required'))
      .max(100, t('customers:errors.name_required')),
    phone: z.string().regex(PK_PHONE_RE, t('customers:errors.phone_invalid')),
    address: z.string().max(250).optional().default(''),
    notes: z.string().max(1000).optional().default('')
  })

type Props = {
  mode: 'create' | 'edit'
  defaultValues?: Partial<CustomerFormValues>
  compact?: boolean
  submitting?: boolean
  onSubmit: (values: CustomerFormValues) => Promise<void> | void
  onCancel?: () => void
  submitLabel?: string
  cancelLabel?: string
  /** Top-level error (e.g. unique-violation), rendered as inline Alert. */
  topError?: string | null
}

export default function CustomerForm({
  defaultValues,
  compact = false,
  submitting = false,
  onSubmit,
  onCancel,
  submitLabel,
  cancelLabel,
  topError
}: Props) {
  const { t } = useTranslation(['customers', 'common'])
  const [showMore, setShowMore] = useState(!compact)

  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(schema(t)),
    defaultValues: {
      name: defaultValues?.name ?? '',
      phone: defaultValues?.phone ?? '',
      address: defaultValues?.address ?? '',
      notes: defaultValues?.notes ?? ''
    }
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Stack spacing={2}>
        {topError && <Alert severity='error'>{topError}</Alert>}

        <Controller
          control={control}
          name='name'
          render={({ field }) => (
            <TextField
              {...field}
              label={t('customers:fields.name')}
              fullWidth
              error={!!errors.name}
              helperText={errors.name?.message}
            />
          )}
        />

        <Controller
          control={control}
          name='phone'
          render={({ field }) => (
            <TextField
              {...field}
              label={t('customers:fields.phone')}
              placeholder='+92xxxxxxxxxx'
              fullWidth
              error={!!errors.phone}
              helperText={errors.phone?.message}
            />
          )}
        />

        {compact && (
          <Box>
            <Button
              size='small'
              onClick={() => setShowMore((v) => !v)}
              startIcon={showMore ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{ ps: 0 }}
            >
              {t('customers:show_more_fields')}
            </Button>
          </Box>
        )}

        <Collapse in={showMore} unmountOnExit>
          <Stack spacing={2}>
            <Controller
              control={control}
              name='address'
              render={({ field }) => (
                <TextField
                  {...field}
                  label={t('customers:fields.address_optional')}
                  fullWidth
                  multiline
                  minRows={2}
                  error={!!errors.address}
                  helperText={errors.address?.message}
                />
              )}
            />
            <Controller
              control={control}
              name='notes'
              render={({ field }) => (
                <TextField
                  {...field}
                  label={t('customers:fields.notes_optional')}
                  fullWidth
                  multiline
                  minRows={2}
                  error={!!errors.notes}
                  helperText={errors.notes?.message}
                />
              )}
            />
          </Stack>
        </Collapse>

        <Stack direction='row' spacing={1} justifyContent='flex-end'>
          {onCancel && (
            <Button onClick={onCancel} disabled={submitting}>
              {cancelLabel ?? t('common:actions.cancel')}
            </Button>
          )}
          <Button type='submit' variant='contained' disabled={submitting}>
            {submitLabel ?? t('customers:actions.save')}
          </Button>
        </Stack>
      </Stack>
    </form>
  )
}

// Helper: detect Postgres unique-violation from a Supabase error.
export function isPhoneDuplicateError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: string; message?: string }
  if (e.code === '23505') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('duplicate') || m.includes('unique')
}
