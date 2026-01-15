import { useEffect, useState } from 'react'
import { useAuth } from 'src/context/AuthProvider'
import ConnectYourBank from './components/connect-your-bank'
import SelectYourBank from './components/select-bank'
import RequireConsent from './components/require-consent'
import ConnectionSuccessful from './components/connection-successful'
import BankDetails from './components/bank-details'
import { useFetchAllInstitutionsData } from './hooks/useFetchInstitutions'
import { useSearchParams } from 'react-router'
import { useCheckBankConnectionHealth } from 'src/hooks/useCheckBankConnectionHealth'
import { Box } from '@mui/material'

export type Step =
  | 'bank-details'
  | 'connect-bank'
  | 'select-bank'
  | 'require-consent'
  | 'success'

const BankIntegrator = () => {
  const { accessToken } = useAuth()
  const connectionId = localStorage.getItem('bank_connection_id')
  useFetchAllInstitutionsData(!!accessToken)
  const [searchParams] = useSearchParams()
  const isConnectionSuccessful =
    searchParams.get('connection-successful') === 'true'
  const reconfirmConnection =
    searchParams.get('reconfirm-connection') === 'true'

  const [currentStep, setCurrentStep] = useState<Step>('connect-bank')

  const { data } = useCheckBankConnectionHealth(!!accessToken)

  const searchString = searchParams.toString()
  const hasError =
    !!searchParams.get('error') ||
    !!searchParams.get('error-source') ||
    !!searchParams.get('error-description')

  useEffect(() => {
    if (hasError) {
      setCurrentStep('connect-bank')
      return
    }

    if (reconfirmConnection) {
      setCurrentStep('require-consent')
      return
    }

    if (isConnectionSuccessful && connectionId) {
      setCurrentStep('success')
    } else if (data?.has_connection && data?.days_left) {
      setCurrentStep('bank-details')
    }
  }, [
    data,
    isConnectionSuccessful,
    reconfirmConnection,
    connectionId,
    searchString,
    hasError
  ])

  const goToStep = (step: Step) => {
    setCurrentStep(step)
  }

  const renderStep = () => {
    switch (currentStep) {
      case 'bank-details':
        return <BankDetails goToStep={goToStep} />
      case 'connect-bank':
        return <ConnectYourBank goToStep={goToStep} />
      case 'select-bank':
        return <SelectYourBank goToStep={goToStep} />
      case 'require-consent':
        return <RequireConsent goToStep={goToStep} />
      case 'success':
        return <ConnectionSuccessful />
      default:
        return null
    }
  }

  return (
    <Box
      sx={{
        borderRadius: '24px',
        border: '1px solid var(--grey-200)',
        overflow: 'hidden'
      }}
    >
      {renderStep()}
    </Box>
  )
}

export default BankIntegrator
