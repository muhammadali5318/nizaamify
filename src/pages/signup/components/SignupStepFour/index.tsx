import { Box, Button, Divider, Stack, Typography } from '@mui/material'
import FormHeader from '../FormHeader'
import { useNavigate } from 'react-router'
import styles from './signupStepFour.module.scss'
import SignupSupscriptionCard from 'src/components/subscription'
import UserConfirmationModal, {
  UserConfirmationTypes
} from 'src/pages/team-management/invitations/components/UserConfirmatinoModal'
import { useState } from 'react'

const SignupStepFour = () => {
  const navigate = useNavigate()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<UserConfirmationTypes>('')
  const step = 3

  return (
    <Stack spacing={2.5}>
      <Stack spacing={'2px'}>
        <FormHeader activeStep={step} showHeading={false} />
        <img
          className='icon-dimension--64'
          src='/assets/star.svg'
          alt='star icon'
        />
        <Typography variant='h5' fontWeight={700}>
          Choose your subscription plan to continue
        </Typography>
        <Typography variant='subtitle1' color='text.secondary'>
          You&apos;re almost there! Select the perfect plan for your dental
          practice to unlock the full MonAI platform.
        </Typography>
      </Stack>
      <Box className={styles.subscriptionCardContainer}>
        <SignupSupscriptionCard
          mode='light'
          title='Free trial'
          planType='FREE TRIAL'
          subtitle='30 Days'
          buttonTitle='30 days free trial'
          price={0}
          description='Ideal for individuals who want to explore Monai with no upfront commitment.'
          benefits={[
            '30 days full access to MonAI platform',
            'Access to all core features',
            'Complete financial dashboard',
            'AI-powered insights',
            'Priority customer support',
            'Cancel anytime, no charges'
          ]}
        />

        <SignupSupscriptionCard
          mode='dark'
          title='Professional plan'
          planType='PROFESSIONAL'
          price={199}
          buttonTitle='Get started now'
          priceSuffix='/ Month'
          description='Ideal for practices that need advanced insights and tools to manage finances effectively.'
          headerIcon='/assets/star-bg-grey.svg'
          benefits={[
            'Full KPI dashboard & benchmarking insights',
            'AI-powered financial assistant',
            'Drag & drop uploads with OCR',
            'Downloadable monthly & annual reports',
            'Priority customer support'
          ]}
        />
      </Box>
      <Box
        width={'100%'}
        display={'flex'}
        justifyContent={'center'}
        alignItems={'center'}
      >
        <Button
          variant='outlined'
          size='large'
          onClick={() => {
            setModalMode('CHOOSE_PACKAGE_LATER')
            setIsModalOpen(true)
          }}
        >
          I&apos;ll choose later
        </Button>
      </Box>
      <Box className={styles.signupStepFourStripBanner}>
        <img src='/assets/stripe.svg' alt='stripe icon' />
        <Divider orientation={'vertical'} flexItem />
        <Typography variant='subtitle1'>
          Billing and subscription management are securely handled through{' '}
          <strong>Stripe</strong> , our trusted payment partner.
        </Typography>
      </Box>

      <UserConfirmationModal
        open={isModalOpen}
        mode={modalMode}
        onClose={() => navigate('/auth/verify-email?emailVerified=true')}
        onConfirm={() => setIsModalOpen(false)}
      />
    </Stack>
  )
}

export default SignupStepFour
