import { LoadingButton } from '@mui/lab'
import {
  Box,
  Stack,
  FormControlLabel,
  Checkbox,
  Typography
} from '@mui/material'
import { Controller, useForm } from 'react-hook-form'
import PasswordField from 'src/components/common/PasswordField'
import { zodResolver } from '@hookform/resolvers/zod'
import styles from './CreatePassoword.module.scss'
import {
  SignupStepThreeFormValues,
  SignupStepThreeSchema
} from 'src/schema-validations/signupStepThreeValidations'

// ✅ Define props type
type CreatePasswordProps = {
  setStep: React.Dispatch<React.SetStateAction<number>>
}

const CreatePassword: React.FC<CreatePasswordProps> = ({ setStep }) => {
  // ✅ Setup useForm with zod
  const {
    control,
    handleSubmit,
    formState: { isValid }
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

  // ✅ Submit handler
  const onSubmit = (data: SignupStepThreeFormValues) => {
    // eslint-disable-next-line no-console
    console.log('Form submitted:', data)

    // Move to Congratulations step
    setStep(3)
  }

  return (
    <Box>
      <Box
        className={styles.createPasswordContainer}
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
            {['terms', 'privacy', 'disclaimer', 'gdpr'].map((name) => (
              <Controller
                key={name}
                name={name as keyof SignupStepThreeFormValues}
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Checkbox {...field} checked={field.value} />}
                    label={
                      <Typography variant='body1'>
                        {name === 'terms' && (
                          <>
                            I agree to the{' '}
                            <span className='info-main font-weight--700'>
                              Terms of Service
                            </span>
                          </>
                        )}
                        {name === 'privacy' && (
                          <>
                            I agree to the{' '}
                            <span className='info-main font-weight--700'>
                              Privacy Policy
                            </span>
                          </>
                        )}
                        {name === 'disclaimer' && (
                          <>
                            I acknowledge the{' '}
                            <span className='info-main font-weight--700'>
                              Financial Disclaimer
                            </span>
                          </>
                        )}
                        {name === 'gdpr' && (
                          <>
                            I consent to data usage under{' '}
                            <span className='info-main font-weight--700'>
                              GDPR
                            </span>
                          </>
                        )}
                      </Typography>
                    }
                  />
                )}
              />
            ))}
          </Stack>

          <Box className='center-align-width--100'>
            <LoadingButton
              type='submit'
              size='large'
              variant='contained'
              color='primary'
              disabled={!isValid}
              loading={false}
              className='width--100'
              loadingPosition='end'
            >
              Save & continue
            </LoadingButton>
          </Box>
        </Stack>
      </Box>
    </Box>
  )
}

export default CreatePassword
