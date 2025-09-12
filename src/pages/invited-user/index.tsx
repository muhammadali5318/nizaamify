import { useState } from 'react'
import { Box } from '@mui/material'
import RegistrationHeader from 'src/components/registration-wrapper/RegistrationHeader'
import RegistrationWrapper from 'src/components/registration-wrapper/RegistrationWrapper'
import styles from './index.module.scss'
import CreatePassword from './components/CreatePassword'
import Congratulations from 'src/components/congratulations'
import Welcome from './components/Welcome'

const InvitedUserOnboarding = () => {
  const [step, setStep] = useState(1)

  // Render based on step
  const renderStep = () => {
    switch (step) {
      case 1:
        return <Welcome setStep={setStep} />
      case 2:
        return <CreatePassword setStep={setStep} />
      case 3:
        return (
          <Congratulations
            message={'Your account has been created  successfully.'}
          />
        )
      default:
        return <Welcome setStep={setStep} />
    }
  }

  return (
    <RegistrationWrapper>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          height: '100%',
          px: 2
        }}
      >
        <RegistrationHeader />

        <Box className={styles.invitedUserOnboardingRoot}>{renderStep()}</Box>
      </Box>
    </RegistrationWrapper>
  )
}

export default InvitedUserOnboarding
