import {
  Box,
  Button,
  CircularProgress,
  Link,
  Stack,
  Typography
} from '@mui/material'
import styles from './requireConsent.module.scss'
import { ChevronLeft } from '@mui/icons-material'
import RenderUlList from 'src/components/render-ul-list'
import { Step } from '../..'
import { useSelector } from 'react-redux'
import { selectSelectedInstitution } from 'src/store/slices/selectedInstitution'
import { paths } from 'src/paths'
import { useEffect, useState } from 'react'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { useActivePractice } from 'src/hooks/useActivePractice'
import dayjs from 'dayjs'
import { useSearchParams } from 'react-router'
import { AxiosResponse } from 'axios'

interface RequireConsentProps {
  goToStep: (step: Step) => void
}

const RequireConsent = ({ goToStep }: RequireConsentProps) => {
  const institution = useSelector(selectSelectedInstitution)
  const [connectionURL, setConnectionURL] = useState(null)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const { activePracticeId } = useActivePractice()
  const [searchParams] = useSearchParams()
  const reconfirmConnection =
    searchParams.get('reconfirm-connection') === 'true'
  const institutionIdParam = searchParams.get('institution-id')
  const handleBack = () => {
    goToStep('select-bank')
  }
  const consentValidUntil = dayjs().add(90, 'day').format('DD/MM/YYYY')

  const fetchConnectionURL = async () => {
    const institutionId = institution?.id ?? institutionIdParam

    const url = reconfirmConnection
      ? endpoints.bankIntegrator.reconsentConfirm(activePracticeId ?? '')
      : endpoints.bankIntegrator.connectionUrl(activePracticeId ?? '')

    let response: AxiosResponse<any>
    if (reconfirmConnection) {
      response = await apiClient.patch(url, { institution_id: institutionId })
    } else {
      response = await apiClient.post(url, { institution_id: institutionId })
    }

    const { authorisation_url, connection_id } = response?.data?.data ?? {}

    if (connection_id) {
      localStorage.setItem('bank_connection_id', connection_id)
    }

    setConnectionURL(authorisation_url ?? null)
  }
  useEffect(() => {
    fetchConnectionURL()
  }, [institution])

  const handleConfirm = () => {
    if (!connectionURL || isRedirecting) return

    setIsRedirecting(true)
    window.location.href = connectionURL
  }

  return (
    <Box className={styles.selectYourBankRoot}>
      <Box className={styles.selectYourBankContainer}>
        <Button
          startIcon={<ChevronLeft />}
          variant='text'
          size='small'
          onClick={handleBack}
        >
          Back
        </Button>
        <Stack spacing={1}>
          <Typography variant='h5' component='h1' fontWeight={700}>
            Consent Required
          </Typography>
          <Typography variant='body1' color='text.secondary'>
            Please review and confirm your consent
          </Typography>
        </Stack>
        <Box className={styles.consentContainer}>
          <Typography variant='body1' component='div' sx={{ lineHeight: 1.8 }}>
            We have partnered with <strong> Yapily Connect</strong> to access
            your bank data{' '}
            {institution?.full_name ? `at ${institution?.full_name}` : ''}.
            <br />
            <br />
            You will now be securely redirected to{' '}
            <strong>{institution?.full_name}</strong> to give access to the
            following information:
            <br />
            <br />
            <RenderUlList
              variant='body1'
              fontWeight={400}
              items={['Account(s) details', 'Balances', 'Transaction history']}
            />
            <br />
            By using the service, you agree to Yapily Connect accessing your
            bank data, the{' '}
            <Link
              href={paths.agreements + '?terms'}
              target='_blank'
              rel='noopener'
              color='info.main'
              underline='hover'
            >
              Terms & Conditions
            </Link>{' '}
            and{' '}
            <Link
              href={paths.agreements + '?privacy'}
              target='_blank'
              rel='noopener'
              color='info.main'
              underline='hover'
            >
              Privacy Notice
            </Link>
            .
            <br />
            <br />
            This consent will be valid until{' '}
            <strong>{consentValidUntil}</strong>.
          </Typography>
        </Box>
        <Box width='100%' display='flex' gap={2.5}>
          <Button
            size='large'
            variant='outlined'
            sx={{ flex: 1 }}
            onClick={handleBack}
          >
            Cancel
          </Button>
          <Button
            size='large'
            variant='contained'
            sx={{ flex: 1 }}
            onClick={handleConfirm}
            disabled={!connectionURL || isRedirecting}
            startIcon={
              (isRedirecting || !connectionURL) && (
                <CircularProgress size={20} color='inherit' />
              )
            }
          >
            {!connectionURL
              ? 'Preparing secure connection...'
              : isRedirecting
                ? 'Redirecting to bank...'
                : 'Confirm'}
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

export default RequireConsent
