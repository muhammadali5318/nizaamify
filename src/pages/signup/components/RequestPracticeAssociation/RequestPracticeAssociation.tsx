import React from 'react'
import { Typography } from '@mui/material'
import RegistrationHeader from 'src/components/registration-wrapper/RegistrationHeader'
import RegistrationWrapper from 'src/components/registration-wrapper/RegistrationWrapper'
import PracticeAlreadyExists from './PracticeAlreadyExists'
import AddAssociationReason from './AddAssociationReason'
import { AssociationPayload } from '../..'
import EmailVerificationStatus from '../EmailVerification/EmailVerificationStatus'
import { useNavigate } from 'react-router'
import HavingTrouble from 'src/components/contact-support/HavingTrouble'

interface RequestPracticeAssociationProps {
  setActiveStep: React.Dispatch<React.SetStateAction<number>>
  activeStep: number
  payload?: AssociationPayload | null
}

const RequestPracticeAssociation: React.FC<RequestPracticeAssociationProps> = ({
  setActiveStep,
  activeStep,
  payload = null
}) => {
  const navigate = useNavigate()
  return (
    <RegistrationWrapper>
      <RegistrationHeader />

      {/* Pass payload down to children so they can pre-fill UI / submit the request */}
      {activeStep === 3 && (
        <PracticeAlreadyExists
          setActiveStep={setActiveStep}
          practiceName={payload?.practiceName}
        />
      )}

      {activeStep === 5 && (
        <AddAssociationReason setActiveStep={setActiveStep} payload={payload} />
      )}

      {activeStep === 6 && (
        <EmailVerificationStatus
          iconSrc='/assets/verified.svg'
          iconAlt='Verified'
          buttonText='Close & continue'
          onButtonClick={() => navigate('/auth/login')}
          footer={<HavingTrouble />}
        >
          <>
            <Typography variant='h5' className='font-weight--700'>
              Your request has been sent for approval
            </Typography>
            <Typography variant='subtitle1' color='textSecondary'>
              Your access request has been submitted to the practice
              administrator for review. You’ll be notified via email once your
              request has been approved or declined.
            </Typography>
          </>
        </EmailVerificationStatus>
      )}
    </RegistrationWrapper>
  )
}

export default RequestPracticeAssociation
