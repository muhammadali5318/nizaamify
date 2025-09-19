// FILE: src/pages/SignUp/SignUp.tsx
import React, { useCallback, useState } from 'react'
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Divider,
  Typography
} from '@mui/material'
import RegistrationWrapper from 'src/components/registration-wrapper/RegistrationWrapper'
import styles from './SignUp.module.scss'
import {
  CustomStepperConnector,
  StepperLabelSX
} from 'src/components/common/CustomStepperConnector'
import { generatePayloadForSignUp, steps } from './signUp-config'
import RegistrationHeader from 'src/components/registration-wrapper/RegistrationHeader'
import NominateNowContainer from 'src/components/nominate-now'
import StepFour from './components/Four'
import StepOne from './components/StepOne'
import StepTwo from './components/StepTwo'
import StepThree from './components/Three'

// import typed form value types from your zod validation modules
import { StepOneFormValues } from 'src/schema-validations/practice-onboarding/stepOne'
import { StepTwoFormValues } from 'src/schema-validations/practice-onboarding/stepTwo'
import { StepThreeFormValues } from 'src/schema-validations/practice-onboarding/stepThree'
import { StepFourFormValues } from 'src/schema-validations/practice-onboarding/stepFour'
import SaveAndExitDialogue from './components/SaveAndExitDialogue/SaveAndExitDialogue'
import NominatePracticeManagerDialog from 'src/components/nomiate-practice-manage'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'

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
  practiceManagementSoftware: 'EXACT',
  accountingSoftware: 'Xero',
  useOfAccountantBookkeeper: 'internal'
}

const initialStepFour: StepFourFormValues = {
  frequencyOfFinancialReview: 'Monthly',
  primaryReasons: [],
  confidenceReadingReports: 'Confident',
  preferredInsightsFormat: 'Visual Dashboards'
}

const PracticeOnboardingFlow: React.FC = () => {
  const navigate = useNavigate()
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

  const handleSend = (payload: { email: string; role: string }) => {
    // call your API to send invite
    // eslint-disable-next-line no-console
    console.log('send invite', payload)
    navigate(`${paths.practiceOnboarding}?step=INVITATION_SENT`)
  }
  const handleDialogConfirm = () => {
    // eslint-disable-next-line no-console
    console.log('Saving progress...')
    // maybe save to localStorage or API
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
      setActiveStep((s) => Math.min(steps.length - 1, s + 1))
    },
    [activeStep, setStepOne, setStepTwo, setStepThree, setStepFour]
  )

  const handleBack = useCallback(() => {
    setActiveStep((s) => Math.max(0, s - 1))
  }, [])

  // Final submit (merge all step data into single payload and POST)
  const handleSubmitAll = async (patch?: any) => {
    // apply optional final patch to the relevant step state
    if (patch) {
      // if we are on the final step when this is called, merge into stepFour
      setStepFour(patch as Partial<StepFourFormValues>)
    }

    const finalForm = {
      ...stepOneData,
      ...stepTwoData,
      ...stepThreeData,
      ...stepFourData,
      ...(patch || {})
    }

    const payload = generatePayloadForSignUp(finalForm)
    // eslint-disable-next-line no-console
    console.log(payload)
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
        <RegistrationHeader
          heading='Welcome to monai!'
          subHeading='Let’s get you onboarded!'
        />

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
                      color={`${
                        activeStep >= index
                          ? 'var(--color-text-primary)'
                          : 'var(--color-text-secondary)'
                      }`}
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

          <Divider orientation='vertical' flexItem className={styles.divider} />

          <Box className={styles.right}>
            <Box className={styles.placeholderBox}>
              {renderStepContent(activeStep)}
            </Box>
          </Box>
        </Box>
      </Box>
      <SaveAndExitDialogue
        open={openDialog}
        onClose={handleDialogClose}
        onConfirm={handleDialogConfirm}
      />
      <NominatePracticeManagerDialog
        open={openNominate}
        onClose={() => setOpenNominate(false)}
        onSend={handleSend}
      />
    </RegistrationWrapper>
  )
}

export default PracticeOnboardingFlow
