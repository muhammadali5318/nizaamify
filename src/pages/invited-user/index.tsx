import { useEffect, useMemo, useState } from 'react'
import { Box, CircularProgress, Typography } from '@mui/material'
import RegistrationHeader from 'src/components/registration-wrapper/RegistrationHeader'
import RegistrationWrapper from 'src/components/registration-wrapper/RegistrationWrapper'
import CreatePassword from './components/CreatePassword'
import Congratulations from 'src/components/congratulations'
import Welcome from './components/Welcome'
import UserInformation from './components/UserInformation'
import { useLocation, useNavigate } from 'react-router'
import apiClient from 'src/services/api-client'
import EmailVerificationStatus from '../signup/components/EmailVerification/EmailVerificationStatus'
import { paths } from 'src/paths'
import { endpoints } from 'src/services/backendUrl'
import ContactSupport from 'src/components/contact-support'

const InvitedUserOnboarding = () => {
  const [step, setStep] = useState<number | null>(null)
  const navigate = useNavigate()

  const [userInfo, setUserInfo] = useState<Record<string, any> | null>(null)
  const [invitationInfo, setInvitationInfo] = useState<Record<
    string,
    any
  > | null>(null)
  const [, setPasswordInfo] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const location = useLocation()
  const query = useMemo(() => new URLSearchParams(location.search), [location])

  const token = query.get('token') ?? null
  const invitationId = query.get('invitation_id') ?? null
  const userID = query.get('user_id') ?? null

  useEffect(() => {
    let ignore = false

    const fetchInvitedUserDetails = async () => {
      try {
        setLoading(true)
        const resp = await apiClient.get(
          endpoints.inviteUser(invitationId ?? ''),
          {
            params: { token }
          }
        )
        if (!ignore) {
          setInvitationInfo(resp?.data?.data ?? null)
          setStep(1)
          setError(null)
        }
      } catch (err: any) {
        if (err?.error[0].includes('invitation is no longer active')) {
          setStep(5)
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    const fetchAcceptedUserDetails = async () => {
      try {
        setLoading(true)
        const resp = await apiClient.get(
          endpoints.accessRequestUserDetails(userID),
          {
            params: { token }
          }
        )
        if (!ignore) {
          setInvitationInfo(resp?.data?.data ?? null)
          setStep(1)
          setError(null)
        }
      } catch (err: any) {
        if (err?.error[0].includes('invitation is no longer active')) {
          setStep(5)
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    if (invitationId) {
      fetchInvitedUserDetails()
    } else if (userID) {
      fetchAcceptedUserDetails()
    }

    return () => {
      ignore = true
    }
  }, [invitationId])

  const handleUserInformationNext = (data: Record<string, any>) => {
    setUserInfo(data)
    setStep(3)
  }

  const handleCreatePasswordNext = async (data: Record<string, any>) => {
    setPasswordInfo(data)

    const left = userInfo ?? {}
    const right = data ?? {}

    const payload = {
      token: token,
      first_name: left.firstName ?? left.first_name ?? '',
      last_name: left.lastName ?? left.last_name ?? '',
      contact_number: left.phone,
      new_password: right.password ?? '',
      confirm_password: right.confirmPassword ?? '',
      is_terms_of_service_accepted: (left.terms ?? right.terms) === true,
      is_privacy_policy_accepted: (left.privacy ?? right.privacy) === true,
      is_financial_disclaimer_acknowledged:
        (left.disclaimer ?? right.disclaimer) === true,
      is_gdpr_consent_given: (left.gdpr ?? right.gdpr) === true
    }

    try {
      await apiClient.put(
        invitationId
          ? endpoints.inviteUser(invitationId)
          : endpoints.accessRequestUserDetails(userID),
        payload
      )
      setStep(4)
    } catch (err) {
      setStep(5)
      console.error(err)
    }
  }

  // Render based on step
  const renderStep = () => {
    if (loading) return <CircularProgress />
    if (error) return <p style={{ color: 'red' }}>{error}</p>

    switch (step) {
      case 1:
        return (
          <Welcome
            setStep={setStep}
            inviteeRole={invitationInfo?.invitee_role}
            practiceName={invitationInfo?.practice_name}
            isAccessRequest={!!userID}
          />
        )
      case 2:
        return (
          <UserInformation
            onNext={handleUserInformationNext}
            defaultEmail={
              invitationInfo?.invitee_email ?? invitationInfo?.email
            }
            defaultFirstName={invitationInfo?.first_name}
            defaultLastName={invitationInfo?.first_name}
            defaultContact={invitationInfo?.contact_number}
          />
        )
      case 3:
        return <CreatePassword onNext={handleCreatePasswordNext} />
      case 4:
        return (
          <Congratulations
            message={'Your account has been created successfully.'}
          />
        )
      case 5:
        return (
          <EmailVerificationStatus
            iconSrc='/assets/warning.svg'
            iconAlt='Warning — link expired'
            buttonText={'Continue'}
            disabled={false}
            onButtonClick={() => navigate(paths.auth.login)}
            footer={
              <>
                <Typography variant='subtitle1' color='textSecondary'>
                  If you still haven’t received the email, please{' '}
                  <ContactSupport />
                </Typography>
              </>
            }
          >
            <>
              <Typography variant='h4' className='font-weight--700'>
                Invitation link expired
              </Typography>
              <Typography variant='subtitle1' color='textSecondary'>
                The invitation link you used is no longer valid. Invitation
                links are valid for 7 days.
              </Typography>
              <Typography variant='subtitle1' color='textSecondary'>
                You can request a new invitation from your practice admin.
              </Typography>
            </>
          </EmailVerificationStatus>
        )

      default:
        return (
          <EmailVerificationStatus
            iconSrc='/assets/danger.svg'
            iconAlt='Invalid link'
            buttonText='Back to Login'
            onButtonClick={() => navigate(paths.auth.login)}
          >
            <>
              <Typography variant='h4' className='font-weight--700'>
                Invalid invitation link
              </Typography>
              <Typography variant='subtitle1' color='textSecondary'>
                Invitation link is not valid. It may be broken or has already
                been used.
              </Typography>
            </>
          </EmailVerificationStatus>
        )
    }
  }

  return (
    <RegistrationWrapper>
      <RegistrationHeader />
      <Box>{renderStep()}</Box>
    </RegistrationWrapper>
  )
}

export default InvitedUserOnboarding
