import React from 'react'
import {
  Box,
  Typography,
  Button,
  Stack,
  Divider,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  FormHelperText
} from '@mui/material'
import RenderUlList from '../render-ul-list'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

export interface GetUserReasonProps {
  onBack: () => void
  onArchive: (reason: string) => void

  introTitle?: string
  introItems?: Array<string | React.ReactNode>
  questionTitle?: string
  reasonOptions?: string[]
  otherOptionValue?: string
  otherLabel?: string
  otherMaxChars?: number

  backButtonText?: string
  submitButtonText?: string

  children?: React.ReactNode
}

export function GetUserReason({
  onBack,
  onArchive,
  introTitle = 'Reason Of Archiving',
  introItems = [
    <Typography variant='subtitle1' key='intro-1'>
      The practice will be moved to <strong>archived status</strong>{' '}
      immediately.
    </Typography>,
    <Typography variant='subtitle1' key='intro-2'>
      You will retain <strong>read-only access</strong> to its historical data.
    </Typography>,
    <Typography variant='subtitle1' key='intro-3'>
      You can <strong>restore the practice</strong> at any time from the
      Practice Settings section.
    </Typography>
  ],
  questionTitle = 'Will you help us learn why?',
  reasonOptions = [
    'The practice is no longer operational.',
    'The data is no longer needed actively.',
    'We’ve merged with another practice.',
    'I’m testing or cleaning up accounts.',
    'Other'
  ],
  otherOptionValue = 'Other',
  otherLabel = 'Reason',
  otherMaxChars = 1500,
  backButtonText = 'Back',
  submitButtonText = 'Archive practice',
  children
}: GetUserReasonProps) {
  const schema = z
    .object({
      reason: z.string().min(1, 'Please select a reason'),
      otherReason: z
        .string()
        .max(otherMaxChars, `Maximum ${otherMaxChars} characters allowed`)
        .optional()
    })
    .refine(
      (data) => {
        if (data.reason === otherOptionValue && !data.otherReason?.trim()) {
          return false
        }
        return true
      },
      { message: 'Please provide a reason', path: ['otherReason'] }
    )

  type FormValues = z.infer<typeof schema>

  const {
    control,
    watch,
    handleSubmit,
    formState: { errors, isValid }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { reason: '', otherReason: '' }
  })

  const selectedReason = watch('reason')

  const onSubmit = (data: FormValues) => {
    const finalReason =
      data.reason === otherOptionValue
        ? (data.otherReason ?? '').trim()
        : data.reason
    onArchive(finalReason)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={2.5}>
        <Divider />
        <Stack spacing={1.8}>
          <Stack spacing={'2px'}>
            <Typography variant='h5' fontWeight={700}>
              {introTitle}
            </Typography>

            <RenderUlList
              variant='subtitle1'
              fontWeight={400}
              items={introItems}
            />
          </Stack>

          <Stack spacing={'2px'}>
            <Typography variant='h5' fontWeight={700}>
              {questionTitle}
            </Typography>

            <Controller
              name='reason'
              control={control}
              render={({ field }) => (
                <>
                  <RadioGroup {...field}>
                    {reasonOptions.map((opt) => (
                      <FormControlLabel
                        key={opt}
                        value={opt}
                        control={<Radio />}
                        label={opt}
                      />
                    ))}
                  </RadioGroup>
                  {errors.reason && (
                    <FormHelperText error>
                      {errors.reason.message}
                    </FormHelperText>
                  )}
                </>
              )}
            />

            <Controller
              name='otherReason'
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  multiline
                  rows={4}
                  disabled={selectedReason !== otherOptionValue}
                  label={otherLabel}
                  error={!!errors.otherReason}
                  helperText={errors.otherReason?.message}
                  inputProps={{ maxLength: otherMaxChars }}
                />
              )}
            />
          </Stack>

          {children}

          <Box display='flex' gap={1.2}>
            <Button fullWidth variant='outlined' onClick={onBack}>
              {backButtonText}
            </Button>

            <Button
              fullWidth
              color='error'
              variant='contained'
              type='submit'
              disabled={!isValid}
            >
              {submitButtonText}
            </Button>
          </Box>
        </Stack>
      </Stack>
    </form>
  )
}
