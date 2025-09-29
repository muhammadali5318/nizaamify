import { LoadingButton } from '@mui/lab'
import { Box, Stack, Typography } from '@mui/material'
import { useForm } from 'react-hook-form'
import PasswordField from 'src/components/common/PasswordField'
import { zodResolver } from '@hookform/resolvers/zod'
import styles from './CreatePassoword.module.scss'
import {
  inviteUserPasswordSetupSchemaFormValues,
  inviteUserPasswordSetupSchema
} from 'src/schema-validations/inviteUserPasswordSetup'

type CreatePasswordProps = {
  setStep?: React.Dispatch<React.SetStateAction<number>>
  onNext: (data: inviteUserPasswordSetupSchemaFormValues) => Promise<any> | any
}

const CreatePassword: React.FC<CreatePasswordProps> = ({ onNext }) => {
  const {
    control,
    handleSubmit,
    formState: { isValid, isSubmitting }
  } = useForm<inviteUserPasswordSetupSchemaFormValues>({
    resolver: zodResolver(inviteUserPasswordSetupSchema),
    mode: 'onChange',
    defaultValues: {
      password: '',
      confirmPassword: ''
    }
  })

  const onSubmit = async (data: inviteUserPasswordSetupSchemaFormValues) => {
    await onNext(data)
  }

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

          <LoadingButton
            fullWidth
            type='submit'
            size='large'
            variant='contained'
            color='primary'
            loading={isSubmitting}
            disabled={!isValid || isSubmitting}
          >
            Save & continue
          </LoadingButton>
        </Stack>
      </Box>
    </Box>
  )
}

export default CreatePassword
