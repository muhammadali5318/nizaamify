// FILE: src/pages/SignUp/SignUp.tsx
import React, { useCallback, useEffect, useState } from 'react'
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Divider,
  Typography,
  CircularProgress
} from '@mui/material'
import RegistrationWrapper from 'src/components/registration-wrapper/RegistrationWrapper'
import styles from './practiceOnboardingFlow.module.scss'
import {
  CustomStepperConnector,
  StepperLabelSX
} from 'src/components/common/CustomStepperConnector'
import { steps } from './practice-onboarding-config'
import RegistrationHeader from 'src/components/registration-wrapper/RegistrationHeader'
import NominateNowContainer from 'src/components/nominate-now'

import SaveAndExitDialogue from './components/SaveAndExitDialogue/SaveAndExitDialogue'
import NominatePracticeManagerDialog from 'src/components/nomiate-practice-manage'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
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

// initial values for each step — keep in sync with your schemas
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

const PracticeOnboardingFlow: React.FC = () => {
  const { user } = useAuth0()
  const navigate = useNavigate()
  const { accessToken } = useAuth()
  const { data: practice, isLoading } = useInitialData(!!accessToken)

  const [activeStep, setActiveStep] = useState<number>(0)

  // separate state for each step
  const [stepOneData, setStepOneData] =
    useState<StepOneFormValues>(initialStepOne)
  const [stepTwoData, setStepTwoData] =
    useState<StepTwoFormValues>(initialStepTwo)
  const [stepThreeData, setStepThreeData] =
    useState<StepThreeFormValues>(initialStepThree)
  const [stepFourData, setStepFourData] =
    useState<StepFourFormValues>(initialStepFour)

  const [openDialog, setOpenDialog] = useState(false)

  const handleSaveExitClick = () => setOpenDialog(true)
  const handleDialogClose = () => setOpenDialog(false)

  const [openNominate, setOpenNominate] = useState(false)

  useEffect(() => {
    if (!practice) return
    const mapped = mapPracticeApiToForm(practice)

    setStepOne(mapped.stepOne)
    setStepTwo(mapped.stepTwo)
    setStepThree(mapped.stepThree)
    setStepFour(mapped.stepFour)
    setActiveStep(mapped.activeStep)
  }, [practice])
  const handleSaveAndExit = () => {
    navigate(paths.dashboard)
    setOpenDialog(false)
  }

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})

  // typed setters that accept partial patches for convenience
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

  // navigation helpers
  const handleNext = useCallback(
    (patch?: any) => {
      // optionally accept a patch (component may pass current step patch)
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
          default:
            break
        }
      }
      setActiveStep((s) => s + 1)
    },
    [activeStep, setStepOne, setStepTwo, setStepThree, setStepFour]
  )

  const handleBack = useCallback(() => {
    setActiveStep((s) => Math.max(0, s - 1))
  }, [])

  const handleSubmitAll = async (patch?: any) => {
    if (patch) {
      setStepFour(patch as Partial<StepFourFormValues>)
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
            onSaveExitClick={handleSaveExitClick}
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
            onSaveExitClick={handleSaveExitClick}
          />
        )
      case 2:
        return (
          <StepThree
            formData={stepThreeData}
            setFormData={setStepThree}
            onBack={handleBack}
            onNext={(patch?: Partial<StepThreeFormValues>) => handleNext(patch)}
            onSubmit={() =>
              /* noop here; final submit happens in StepFour */ null
            }
            activeStep={activeStep}
            isSubmitting={isSubmitting}
            serverErrors={serverErrors}
            onSaveExitClick={handleSaveExitClick}
          />
        )
      case 3:
        return (
          <StepFour
            formData={stepFourData}
            setFormData={setStepFour}
            onBack={handleBack}
            onSubmit={(patch?: Partial<StepFourFormValues>) =>
              handleSubmitAll(patch)
            }
            onNext={(patch?: Partial<StepFourFormValues>) => handleNext(patch)}
            activeStep={activeStep}
            isSubmitting={isSubmitting}
            serverErrors={serverErrors}
            onSaveExitClick={handleSaveExitClick}
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
          justifyContent: 'flex-start',
          width: '100%',
          height: '100%',
          px: 2
        }}
      >
        {practice?.onboarding_status === 'COMPLETED' ? (
          <RegistrationHeader />
        ) : (
          <RegistrationHeader
            heading={
              <>
                Welcome to monai{' '}
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
        ) : activeStep === 4 ? (
          <Box className={styles.completedContainer}>
            <Congratulations message='You have completed onboarding now access the full system ' />
          </Box>
        ) : (
          <>
            <Box className={styles.container}>
              <Box className={styles.left}>
                <Stepper
                  activeStep={activeStep}
                  orientation='vertical'
                  nonLinear
                  connector={<CustomStepperConnector connectorHeight={30} />}
                >
                  {steps?.map((step, index) => (
                    <Step key={index} completed={activeStep > index}>
                      <StepLabel
                        slotProps={{
                          stepIcon: {
                            sx: { ...StepperLabelSX }
                          }
                        }}
                      >
                        <Typography
                          color={
                            activeStep >= index
                              ? 'var(--color-text-primary)'
                              : 'var(--color-text-secondary)'
                          }
                          variant='subtitle2'
                        >
                          {step.heading}
                        </Typography>
                        <Typography
                          color='var(--color-text-primary)'
                          variant='caption'
                        >
                          {step.subHeading}
                        </Typography>
                      </StepLabel>
                    </Step>
                  ))}
                </Stepper>
                <Box>
                  <NominateNowContainer
                    onSelectNominee={() => setOpenNominate(true)}
                  />
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
      <SaveAndExitDialogue
        open={openDialog}
        onClose={handleDialogClose}
        onOpenNominate={() => setOpenNominate(true)}
        onConfirm={handleSaveAndExit}
      />
      <NominatePracticeManagerDialog
        open={openNominate}
        onClose={() => setOpenNominate(false)}
      />
    </RegistrationWrapper>
  )
}

export default PracticeOnboardingFlow
