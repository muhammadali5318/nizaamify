import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import styles from './NominationFlow.module.scss'
import { Box } from '@mui/material'
import RegistrationHeader from 'src/components/registration-wrapper/RegistrationHeader'
import RegistrationWrapper from 'src/components/registration-wrapper/RegistrationWrapper'
import Welcome from 'src/components/welcome'
import ChooseOnboardingFlow from './components/chooseOnboardingFlow'
import InvitationSent from 'src/components/invitation-sent'

enum FlowStep {
  WELCOME = 'WELCOME',
  CHOOSE_ONBOARDING = 'CHOOSE_ONBOARDING',
  INVITATION_SENT = 'INVITATION_SENT'
}

const NominationFlow = () => {
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState<FlowStep>(FlowStep.WELCOME)

  useEffect(() => {
    const paramStep = searchParams.get('step') as FlowStep | null
    if (paramStep && Object.values(FlowStep).includes(paramStep)) {
      setStep(paramStep)
    }
  }, [searchParams])

  const renderStep = () => {
    switch (step) {
      case FlowStep.WELCOME:
        return (
          <Welcome onContinue={() => setStep(FlowStep.CHOOSE_ONBOARDING)} />
        )
      case FlowStep.CHOOSE_ONBOARDING:
        return (
          <ChooseOnboardingFlow
            onContinue={() => setStep(FlowStep.INVITATION_SENT)}
          />
        )
      case FlowStep.INVITATION_SENT:
        return <InvitationSent />
      default:
        return null
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
        <Box className={styles.nominationFlowRoot}>{renderStep()}</Box>
      </Box>
    </RegistrationWrapper>
  )
}

export default NominationFlow
