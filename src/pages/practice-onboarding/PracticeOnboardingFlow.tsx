import React, { useCallback, useEffect, useState } from 'react'
import { Box, Divider, CircularProgress } from '@mui/material'
import RegistrationWrapper from 'src/components/registration-wrapper/RegistrationWrapper'
import styles from './practiceOnboardingFlow.module.scss'
import AdaptiveStepper from 'src/components/common/AdaptiveStepper'
import { steps } from './practice-onboarding-config'
import RegistrationHeader from 'src/components/registration-wrapper/RegistrationHeader'
import NominateNowContainer from 'src/components/nominate-now'
import NominatePracticeManagerDialog from 'src/components/nomiate-practice-manage'
import { useInitialData } from 'src/hooks/useFetchInitialData'
import { mapPracticeApiToForm } from './mapPracticeToForm'
import Congratulations from 'src/components/congratulations'
import { useAuth } from 'src/context/AuthProvider'
import {
  StepOneFormValues,
  StepTwoFormValues,
  StepThreeFormValues,
  StepFourFormValues
} from 'src/schema-validations/practice-onboarding'
import { StepOne, StepTwo, StepThree, StepFour } from './components'
import { useAuth0 } from '@auth0/auth0-react'
import { isPracticeOwner } from 'src/utils/helper'
import Footer from 'src/components/registration-wrapper/Footer'
import StepFive from './components/stepFive'
import { StepFiveFormValues } from 'src/schema-validations/practice-onboarding/stepFive'

// -------------------------------
// INITIAL VALUES
// -------------------------------
const initialStepOne: StepOneFormValues = {
  practiceName: '',
  principalName: '',
  practiceManagerName: '',
  practiceAddress: '',
  email: '',
  phone: ''
}

const initialStepTwo: StepTwoFormValues = {
  practiceType: '',
  yearsTrading: 0,
  numberOfSurgeries: 0,
  numberOfAssociates: 0,
  numberOfHygienistsTherapists: 0,
  numberOfSpecialists: 0,
  premisesOwnership: ''
}

const initialStepThree: StepThreeFormValues = {
  practiceManagementSoftware: '',
  accountingSoftware: '',
  useOfAccountantBookkeeper: ''
}

const initialStepFour: StepFourFormValues = {
  frequencyOfFinancialReview: '',
  primaryReasons: [],
  confidenceReadingReports: '',
  preferredInsightsFormat: ''
}

const initialStepFive: StepFiveFormValues = {
  accountingBasis: ''
}

const PracticeOnboardingFlow: React.FC = () => {
  const { user } = useAuth0()
  const { accessToken } = useAuth()
  const { data: practice, isLoading } = useInitialData(!!accessToken)

  const [activeStep, setActiveStep] = useState<number>(0)

  // -------------------------------
  // STATE MANAGEMENT
  // -------------------------------
  const [stepOneData, setStepOneData] =
    useState<StepOneFormValues>(initialStepOne)
  const [stepTwoData, setStepTwoData] =
    useState<StepTwoFormValues>(initialStepTwo)
  const [stepThreeData, setStepThreeData] =
    useState<StepThreeFormValues>(initialStepThree)
  const [stepFourData, setStepFourData] =
    useState<StepFourFormValues>(initialStepFour)
  const [stepFiveData, setStepFiveData] =
    useState<StepFiveFormValues>(initialStepFive)

  const [openNominate, setOpenNominate] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})

  // -------------------------------
  // EFFECT: MAP PRACTICE API TO FORM
  // -------------------------------
  useEffect(() => {
    if (!practice) return
    const mapped = mapPracticeApiToForm(practice)

    setStepOne(mapped.stepOne)
    setStepTwo(mapped.stepTwo)
    setStepThree(mapped.stepThree)
    setStepFour(mapped.stepFour)
    setStepFive(mapped.stepFive)
    setActiveStep((prev) => (prev ? prev : mapped.activeStep))
  }, [practice])

  const setStepOne = useCallback(
    (patch: Partial<StepOneFormValues>) =>
      setStepOneData((prev) => ({ ...prev, ...patch })),
    []
  )
  const setStepTwo = useCallback(
    (patch: Partial<StepTwoFormValues>) =>
      setStepTwoData((prev) => ({ ...prev, ...patch })),
    []
  )
  const setStepThree = useCallback(
    (patch: Partial<StepThreeFormValues>) =>
      setStepThreeData((prev) => ({ ...prev, ...patch })),
    []
  )
  const setStepFour = useCallback(
    (patch: Partial<StepFourFormValues>) =>
      setStepFourData((prev) => ({ ...prev, ...patch })),
    []
  )
  const setStepFive = useCallback(
    (patch: Partial<StepFiveFormValues>) =>
      setStepFiveData((prev) => ({ ...prev, ...patch })),
    []
  )

  const handleNext = useCallback(
    (patch?: any) => {
      if (patch) {
        switch (activeStep) {
          case 0:
            setStepOne(patch)
            break
          case 1:
            setStepTwo(patch)
            break
          case 2:
            setStepThree(patch)
            break
          case 3:
            setStepFour(patch)
            break
          case 4:
            setStepFive(patch)
            break
          default:
            break
        }
      }
      setActiveStep((s) => s + 1)
    },
    [activeStep, setStepOne, setStepTwo, setStepThree, setStepFour, setStepFive]
  )

  const handleBack = useCallback(() => {
    setActiveStep((s) => Math.max(0, s - 1))
  }, [])

  const handleSubmitAll = async (patch?: any) => {
    if (patch) {
      setStepFive(patch as Partial<StepFiveFormValues>)
    }

    setIsSubmitting(true)
    setServerErrors({})
  }

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <StepOne
            formData={stepOneData}
            setFormData={setStepOne}
            onNext={(patch?: Partial<StepOneFormValues>) => handleNext(patch)}
            activeStep={activeStep}
            onOpenNominate={() => setOpenNominate(true)}
          />
        )
      case 1:
        return (
          <StepTwo
            formData={stepTwoData}
            setFormData={setStepTwo}
            onNext={(patch?: Partial<StepTwoFormValues>) => handleNext(patch)}
            onBack={handleBack}
            activeStep={activeStep}
            onOpenNominate={() => setOpenNominate(true)}
          />
        )
      case 2:
        return (
          <StepThree
            formData={stepThreeData}
            setFormData={setStepThree}
            onBack={handleBack}
            onNext={(patch?: Partial<StepThreeFormValues>) => handleNext(patch)}
            activeStep={activeStep}
            isSubmitting={isSubmitting}
            serverErrors={serverErrors}
            onOpenNominate={() => setOpenNominate(true)}
          />
        )
      case 3:
        return (
          <StepFour
            formData={stepFourData}
            setFormData={setStepFour}
            onBack={handleBack}
            onNext={(patch?: Partial<StepFourFormValues>) => handleNext(patch)}
            activeStep={activeStep}
            isSubmitting={isSubmitting}
            serverErrors={serverErrors}
            onOpenNominate={() => setOpenNominate(true)}
          />
        )
      case 4:
        return (
          <StepFive
            formData={stepFiveData}
            setFormData={setStepFive}
            onBack={handleBack}
            onSubmit={(patch?: Partial<StepFiveFormValues>) =>
              handleSubmitAll(patch)
            }
            onNext={(patch?: Partial<StepFiveFormValues>) => handleNext(patch)}
            activeStep={activeStep}
            isSubmitting={isSubmitting}
            serverErrors={serverErrors}
            onOpenNominate={() => setOpenNominate(true)}
          />
        )
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
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            flexDirection: 'column'
          }}
        >
          {practice?.onboarding_status === 'COMPLETED' ? (
            <RegistrationHeader />
          ) : (
            <RegistrationHeader
              heading={
                <>
                  Welcome to Monai Tech{' '}
                  <span className='font-weight--700'>{user?.family_name}!</span>
                </>
              }
              subHeading='Let’s set up your practice profile to personalise your experience'
            />
          )}

          {isLoading ? (
            <Box
              sx={{
                py: 6
              }}
            >
              <CircularProgress />
            </Box>
          ) : activeStep === 5 ? (
            <Box className={styles.completedContainer}>
              <Congratulations message='You have completed onboarding now access the full system' />
            </Box>
          ) : (
            <>
              <Box
                className={styles.container}
                sx={{
                  maxWidth: activeStep === 4 ? '1300px' : '1000px '
                }}
              >
                <Box className={styles.left}>
                  <AdaptiveStepper
                    activeStep={activeStep}
                    steps={steps}
                    connectorHeight={30}
                  />
                  <Box>
                    {isPracticeOwner(user) && (
                      <NominateNowContainer
                        onSelectNominee={() => setOpenNominate(true)}
                      />
                    )}
                  </Box>
                </Box>

                <Divider
                  orientation='vertical'
                  flexItem
                  className={styles.divider}
                />

                <Box className={styles.right}>
                  <Box className={styles.placeholderBox}>
                    {renderStepContent(activeStep)}
                  </Box>
                </Box>
              </Box>
            </>
          )}
        </Box>
        <Footer />
      </Box>
      <NominatePracticeManagerDialog
        open={openNominate}
        onClose={() => setOpenNominate(false)}
      />
    </RegistrationWrapper>
  )
}

export default PracticeOnboardingFlow
