import { LoadingButton } from '@mui/lab'
import { Box, Stack, Typography, FormHelperText } from '@mui/material'
import { useForm } from 'react-hook-form'
import PasswordField from 'src/components/common/PasswordField'
import { zodResolver } from '@hookform/resolvers/zod'
import styles from './CreatePassoword.module.scss'
import {
  SignupStepThreeFormValues,
  SignupStepThreeSchema
} from 'src/schema-validations/signupStepThreeValidations'
import AgreementsCheckboxes from 'src/components/agreement-checkboxes'

type CreatePasswordProps = {
  setStep?: React.Dispatch<React.SetStateAction<number>>
  onNext: (data: SignupStepThreeFormValues) => Promise<any> | any
}

const CreatePassword: React.FC<CreatePasswordProps> = ({ onNext }) => {
  const {
    control,
    handleSubmit,
    watch,
    formState: { isValid, isSubmitted, isSubmitting }
  } = useForm<SignupStepThreeFormValues>({
    resolver: zodResolver(SignupStepThreeSchema),
    mode: 'onChange',
    defaultValues: {
      password: '',
      confirmPassword: '',
      terms: false,
      privacy: false,
      disclaimer: false,
      gdpr: false
    }
  })

  const onSubmit = async (data: SignupStepThreeFormValues) => {
    await onNext(data)
  }

  // ✅ Watch checkboxes
  const [terms, privacy, disclaimer, gdpr] = watch([
    'terms',
    'privacy',
    'disclaimer',
    'gdpr'
  ])

  const allChecked = Boolean(terms && privacy && disclaimer && gdpr)

  return (
    <Box>
      <Box
        className={`${styles.formContainerInviteUser} ${styles.createPasswordWidth}`}
        component='form'
        onSubmit={handleSubmit(onSubmit)}
      >
        <Stack spacing={2.5}>
          <Box>
            <Typography variant='h4' className='font-weight--700'>
              Password setup
            </Typography>
            <Typography
              variant='subtitle1'
              color='var(--text-secondary)'
              mt={'2px'}
            >
              Please create a strong password to protect your account
            </Typography>
          </Box>

          <Stack spacing={2}>
            <PasswordField
              helperText='Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character.'
              name='password'
              label='Password'
              control={control}
            />
            <PasswordField
              name='confirmPassword'
              label='Confirm Password'
              control={control}
            />
          </Stack>

          <Stack>
            <AgreementsCheckboxes control={control} hideIndividualErrors />

            {!allChecked && isSubmitted && (
              <FormHelperText error sx={{ mt: 1 }}>
                Please confirm to continue
              </FormHelperText>
            )}
          </Stack>

          <LoadingButton
            fullWidth
            type='submit'
            size='large'
            variant='contained'
            color='primary'
            loading={isSubmitting}
            disabled={!isValid || isSubmitting || !allChecked}
          >
            Save & continue
          </LoadingButton>
        </Stack>
      </Box>
    </Box>
  )
}

export default CreatePassword
