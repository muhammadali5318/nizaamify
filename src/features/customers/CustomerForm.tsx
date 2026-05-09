import { useState } from 'react'
import Box from '@mui/material/Box'
import Collapse from '@mui/material/Collapse'
import Stack from '@mui/material/Stack'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Banner, Button, Field, Input, Textarea } from 'src/components/ui'

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
  /** Top-level error (e.g. unique-violation), rendered as inline Banner. */
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
      <Stack spacing={2.5}>
        {topError && <Banner variant='error'>{topError}</Banner>}

        <Controller
          control={control}
          name='name'
          render={({ field }) => (
            <Field
              label={t('customers:fields.name')}
              error={errors.name?.message}
            >
              <Input {...field} />
            </Field>
          )}
        />

        <Controller
          control={control}
          name='phone'
          render={({ field }) => (
            <Field
              label={t('customers:fields.phone')}
              error={errors.phone?.message}
            >
              <Input {...field} placeholder='+92xxxxxxxxxx' />
            </Field>
          )}
        />

        {compact && (
          <Box>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => setShowMore((v) => !v)}
              startIcon={showMore ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{ paddingInlineStart: 0 }}
            >
              {t('customers:show_more_fields')}
            </Button>
          </Box>
        )}

        <Collapse in={showMore} unmountOnExit>
          <Stack spacing={2.5}>
            <Controller
              control={control}
              name='address'
              render={({ field }) => (
                <Field
                  label={t('customers:fields.address_optional')}
                  error={errors.address?.message}
                >
                  <Textarea {...field} minRows={2} />
                </Field>
              )}
            />
            <Controller
              control={control}
              name='notes'
              render={({ field }) => (
                <Field
                  label={t('customers:fields.notes_optional')}
                  error={errors.notes?.message}
                >
                  <Textarea {...field} minRows={2} />
                </Field>
              )}
            />
          </Stack>
        </Collapse>

        <Stack direction='row' spacing={1.5} justifyContent='flex-end'>
          {onCancel && (
            <Button
              variant='secondary'
              onClick={onCancel}
              disabled={submitting}
            >
              {cancelLabel ?? t('common:actions.cancel')}
            </Button>
          )}
          <Button type='submit' variant='primary' loading={submitting}>
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
