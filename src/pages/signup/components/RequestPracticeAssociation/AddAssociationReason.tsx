import React, { useState } from 'react'
import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import styles from './AddAssociationReason.module.scss'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import RenderUlList from 'src/components/render-ul-list'
import { AssociationPayload } from '../..'
import { apiClientOpen } from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { notify } from 'src/components/notistack/NotificationProvider'
import { useNavigate } from 'react-router'

const schema = z.object({
  reasonForAccess: z
    .string()
    .min(1, 'Reason is required')
    .max(300, 'Maximum 300 characters')
})

type FormSchema = z.infer<typeof schema>

interface Props {
  setActiveStep: React.Dispatch<React.SetStateAction<number>>
  payload?: AssociationPayload | null
}

const AddAssociationReason: React.FC<Props> = ({
  payload = null,
  setActiveStep
}) => {
  const navigate = useNavigate()
  const [isUserExists, setIsUserExists] = useState(false)

  const {
    control,
    handleSubmit,
    watch,
    formState: { isSubmitting }
  } = useForm<FormSchema>({
    resolver: zodResolver(schema),
    defaultValues: { reasonForAccess: payload?.access_request_reason ?? '' },
    mode: 'onChange',
    reValidateMode: 'onChange'
  })

  const reasonValue = watch('reasonForAccess') ?? ''

  const submitHandler = async (data: FormSchema) => {
    const mergedPayload = {
      first_name: payload?.first_name,
      last_name: payload?.last_name,
      email: payload?.email,
      contact_number: payload?.contact_number,
      role: payload?.role,
      is_company_director_or_owner: payload?.is_company_director_or_owner,
      practice_id: payload?.practice_id,
      access_request_reason: data.reasonForAccess
    }

    try {
      await apiClientOpen.post(
        endpoints.signup.requestPracticeAssociation,
        mergedPayload
      )
      setActiveStep(6)
    } catch (error: any) {
      console.error(error)
      const errorString = error?.error ?? ''
      if (
        typeof errorString === 'string' &&
        errorString.includes("'statusCode': 409")
      ) {
        notify.info('User already exists. Awaiting admin approval.')
        setIsUserExists(true)
      } else {
        notify.error('Something went wrong. Please try again.')
      }
    }
  }

  const cancelHandler = () => {
    navigate('/auth/login')
  }

  return (
    <form onSubmit={handleSubmit(submitHandler)} noValidate>
      <Stack className={styles.addAssociationReasonRoot}>
        <img
          src='/assets/user-share.svg'
          alt='user share icon'
          className='icon-dimension--88'
        />

        <Stack spacing={1}>
          <Typography
            variant='h5'
            fontWeight={700}
            sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
          >
            Request access to existing practice
          </Typography>

          <Box>
            <Typography
              variant='subtitle1'
              color='var(--color-text-secondary)'
              sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}
            >
              Please provide your details below to request access to this
              practice account.
            </Typography>
            <Typography
              variant='subtitle1'
              color='var(--color-text-secondary)'
              sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}
            >
              Your request will be sent to the current{' '}
              <strong className='text-color--primary'>Practice Owner</strong>{' '}
              for approval. You’ll receive an email once your access has been
              reviewed.
            </Typography>
          </Box>
        </Stack>

        <Typography
          variant='h5'
          fontWeight={700}
          sx={{ fontSize: { xs: '1.1rem', sm: '1.3rem' } }}
        >
          Request details
        </Typography>

        <Stack spacing={0.2} sx={{ width: '100%' }}>
          <Controller
            name='reasonForAccess'
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                fullWidth
                variant='outlined'
                label='Reason for access'
                required
                multiline
                rows={4}
                inputProps={{ maxLength: 300 }}
                helperText={
                  fieldState.error?.message ??
                  `Briefly explain why you’re requesting access to this practice (up to
          ${field.value?.length ?? 0}/300 characters).`
                }
                error={!!fieldState.error}
              />
            )}
          />
        </Stack>

        <Stack>
          <Typography
            variant='h6'
            fontWeight={700}
            sx={{ fontSize: { xs: '1rem', sm: '1.2rem' } }}
          >
            What happens next:
          </Typography>
          <RenderUlList
            variant='subtitle2'
            fontWeight={400}
            items={[
              'Your request will be sent to the practice owners and Monai admins',
              'They will verify your credentials and relationship to the practice',
              `You'll receive an email notification when your request is approved or requires more information`,
              `Once approved, you'll be able to access the practice account with your assigned role`
            ]}
          />
        </Stack>

        <Box
          sx={{
            display: 'flex',
            gap: 2,
            width: '100%',
            flexWrap: { xs: 'wrap', sm: 'nowrap' }
          }}
        >
          <Button
            variant='outlined'
            fullWidth
            size='large'
            onClick={cancelHandler}
          >
            Cancel
          </Button>

          <Button
            type='submit'
            variant='contained'
            fullWidth
            size='large'
            disabled={
              isSubmitting || reasonValue.trim().length === 0 || isUserExists
            }
          >
            {isSubmitting ? 'Saving…' : 'Submit request'}
          </Button>
        </Box>
      </Stack>
    </form>
  )
}

export default AddAssociationReason
