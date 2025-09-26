import {
  Button,
  Box,
  Typography,
  TextField,
  FormHelperText
} from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import styles from './CreatePassoword.module.scss'
import AgreementsCheckboxes from 'src/components/agreement-checkboxes'
import PhoneField from 'src/components/phone-field'
import parsePhoneNumberFromString from 'libphonenumber-js'

// your schema unchanged
const UserInformationSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email({ message: 'Invalid email address' }),
  phone: z
    .string()
    .nonempty('Phone is required')
    .refine(
      (val) => {
        const phoneNumber = parsePhoneNumberFromString(val || '')
        return phoneNumber?.isValid() ?? false
      },
      {
        message: 'Please enter a valid phone number'
      }
    ),
  terms: z.boolean().refine((val) => val === true, {
    message: 'You must accept Terms'
  }),
  privacy: z.boolean().refine((val) => val === true, {
    message: 'You must accept Privacy Policy'
  }),
  disclaimer: z.boolean().refine((val) => val === true, {
    message: 'You must accept Disclaimer'
  }),
  gdpr: z.boolean().refine((val) => val === true, {
    message: 'You must accept GDPR'
  })
})

type UserInformationSchemaFormValues = z.infer<typeof UserInformationSchema>

type UserInformationProps = {
  setStep?: React.Dispatch<React.SetStateAction<number>>
  onNext: (data: UserInformationSchemaFormValues) => void
  defaultEmail?: string
}

const UserInformation: React.FC<UserInformationProps> = ({
  onNext,
  defaultEmail
}) => {
  const {
    control,
    handleSubmit,
    watch,
    formState: { isValid, isSubmitting, isSubmitted }
  } = useForm<UserInformationSchemaFormValues>({
    resolver: zodResolver(UserInformationSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: defaultEmail,
      phone: '',
      terms: false,
      privacy: false,
      disclaimer: false,
      gdpr: false
    },
    mode: 'onChange',
    reValidateMode: 'onChange'
  })

  const onSubmit = (data: UserInformationSchemaFormValues) => {
    // eslint-disable-next-line no-console
    console.log('UserInformation data:', data)
    onNext(data) // pass data to parent
  }

  // watch the four checkboxes (returns an array)
  const [terms, privacy, disclaimer, gdpr] = watch([
    'terms',
    'privacy',
    'disclaimer',
    'gdpr'
  ])

  const allChecked = Boolean(terms && privacy && disclaimer && gdpr)

  return (
    <Box
      component='form'
      onSubmit={handleSubmit(onSubmit)}
      className={`${styles.formContainerInviteUser} ${styles.userInfoWidth}`}
    >
      <Box>
        <Typography
          variant='h4'
          color='var(--color-primary-black)'
          className='font-weight--700'
        >
          User information
        </Typography>
        <Typography color='var(--color-text-secondary)' variant='subtitle1'>
          Basic user details
        </Typography>
      </Box>

      {/* Grid fields */}
      <Box display='grid' gridTemplateColumns='1fr 1fr' gap={2}>
        {/* First Name */}
        <Controller
          name='firstName'
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              label='First Name'
              required
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              fullWidth
            />
          )}
        />

        {/* Last Name */}
        <Controller
          name='lastName'
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              label='Last Name'
              required
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              fullWidth
            />
          )}
        />

        {/* Email */}
        <Controller
          name='email'
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              type='email'
              label='Email'
              disabled={true}
              required
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              fullWidth
            />
          )}
        />

        {/* Phone */}
        <PhoneField control={control} name='phone' />
      </Box>

      <Box>
        <AgreementsCheckboxes control={control} hideIndividualErrors />

        {!allChecked && isSubmitted && (
          <FormHelperText error sx={{ mt: 1 }}>
            Please confirm to continue
          </FormHelperText>
        )}
      </Box>

      <Button
        disabled={!isValid || isSubmitting}
        size='large'
        type='submit'
        fullWidth
        variant='contained'
      >
        Continue
      </Button>
    </Box>
  )
}

export default UserInformation
