import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Box, CircularProgress } from '@mui/material'
import RegistrationHeader from 'src/components/registration-wrapper/RegistrationHeader'
import RegistrationWrapper from 'src/components/registration-wrapper/RegistrationWrapper'
import Welcome from 'src/components/welcome'
import ChooseOnboardingFlow from './components/chooseOnboardingFlow'
import InvitationSent from 'src/components/invitation-sent'
import { useInitialData } from 'src/hooks/useFetchInitialData'
import { paths } from 'src/paths'
import { useAuth } from 'src/context/AuthProvider'
import Footer from 'src/components/registration-wrapper/Footer'

enum FlowStep {
  WELCOME = 'WELCOME',
  CHOOSE_ONBOARDING = 'CHOOSE_ONBOARDING',
  INVITATION_SENT = 'INVITATION_SENT'
}

const NominationFlow = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState<FlowStep>(FlowStep.WELCOME)
  const { accessToken } = useAuth()
  const { data: practiceData, isLoading } = useInitialData(!!accessToken)

  useEffect(() => {
    const paramStep = searchParams.get('step') as FlowStep | null
    if (paramStep && Object.values(FlowStep).includes(paramStep)) {
      setStep(paramStep)
    }
  }, [searchParams])

  useEffect(() => {
    if (practiceData?.onboarding_status === 'COMPLETED') {
      navigate(`${paths.practiceOnboardingStepper}?status=Onboarding-completed`)
    }
  }, [practiceData])

  const renderStep = () => {
    switch (step) {
      case FlowStep.WELCOME:
        return (
          <Welcome onContinue={() => setStep(FlowStep.CHOOSE_ONBOARDING)} />
        )
      case FlowStep.CHOOSE_ONBOARDING:
        return <ChooseOnboardingFlow />
      case FlowStep.INVITATION_SENT:
        return <InvitationSent practiceName={practiceData?.practice_name} />
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
          justifyContent: 'space-between',
          height: '100vh'
        }}
      >
        <RegistrationHeader />
        {isLoading ? <CircularProgress /> : <Box>{renderStep()}</Box>}
        <Footer />
      </Box>
    </RegistrationWrapper>
  )
}

export default NominationFlow
