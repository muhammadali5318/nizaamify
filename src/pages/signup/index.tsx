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
import SignupStepOne from './components/SignupStepOne'
import SignupStepTwo from './components/SignupStepTwo'
import SignupStepThree from './components/SignupStepThree'
import { generatePayloadForSignUp, steps } from './signUp-config'
import SendVerificationEmail from './components/SendVerificationEmail'
import RegistrationHeader from 'src/components/registration-wrapper/RegistrationHeader'
import { SignupFormDataSet, SetFormDataSet } from './types'
import { apiClientOpen } from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { sendVerificationEmail } from 'src/services/auth/emailVerification'

const initialFormData: SignupFormDataSet = {
  firstName: '',
  lastName: '',
  role: '',
  email: '',
  phone: '',
  isPracticeOwnerOrDirector: false,
  practiceName: '',
  street: '',
  city: '',
  country: '',
  postcode: '',
  practiceEmail: '',
  password: '',
  confirmPassword: '',
  terms: false,
  privacy: false,
  disclaimer: false,
  gdpr: false
}

const SignUp: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(0)
  const [formData, setFormDataState] =
    useState<SignupFormDataSet>(initialFormData)

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})

  const { createUser } = endpoints.signup

  const setFormData = useCallback<SetFormDataSet>((patch) => {
    setFormDataState((prev) => ({ ...prev, ...patch }))

    setServerErrors((prev) => {
      if (!patch) return prev
      const keysToClear = ['email', 'practiceEmail', 'practiceName', 'postcode']
      const newErrors = { ...prev }
      Object.keys(patch).forEach((k) => {
        if (keysToClear.includes(k)) {
          delete newErrors.email
          delete newErrors.practice
        }
      })
      return newErrors
    })
  }, [])

  const handleNext = useCallback(
    (patch?: Partial<SignupFormDataSet>): void => {
      if (patch) setFormData(patch)
      setActiveStep((s) => Math.min(steps.length - 1, s + 1))
    },
    [setFormData, steps.length]
  )

  const handleBack = () => setActiveStep((s) => Math.max(0, s - 1))

  // Final submit: merge last patch (if provided), then submit combined payload to API
  const handleSubmitAll = async (patch?: Partial<SignupFormDataSet>) => {
    if (patch) setFormData(patch)

    const finalForm: SignupFormDataSet = { ...formData, ...(patch || {}) }

    const payload = generatePayloadForSignUp(finalForm)

    setIsSubmitting(true)
    setServerErrors({}) // clear previous server errors on new submit
    try {
      const response = await apiClientOpen.post(createUser, payload)
      if (response.status === 201) {
        setActiveStep(3)
        sendVerificationEmail(finalForm?.email)
      }
    } catch (err: any) {
      const respData = err?.error
      const parsedErrors: Record<string, string> = {}

      if (respData) {
        const userEmailErr =
          respData?.user?.email && Array.isArray(respData.user.email)
            ? respData.user.email.join(' ')
            : respData?.user?.email
        if (userEmailErr) parsedErrors.email = userEmailErr

        const practiceErr =
          respData?.practice?.non_field_errors &&
          Array.isArray(respData.practice.non_field_errors)
            ? respData.practice.non_field_errors.join(' ')
            : respData?.practice?.non_field_errors
        if (practiceErr) parsedErrors.practice = practiceErr
      }

      if (!Object.keys(parsedErrors).length) {
        parsedErrors.general =
          respData?.message || 'Something went wrong. Please try again later.'
      }

      setServerErrors(parsedErrors)
      console.error('Signup failed', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <SignupStepOne
            formData={formData}
            setFormData={setFormData}
            onNext={handleNext}
            activeStep={activeStep}
          />
        )
      case 1:
        return (
          <SignupStepTwo
            formData={formData}
            setFormData={setFormData}
            onNext={handleNext}
            onBack={handleBack}
            activeStep={activeStep}
          />
        )
      case 2:
        return (
          <SignupStepThree
            formData={formData}
            setFormData={setFormData}
            onBack={handleBack}
            onSubmit={handleSubmitAll}
            activeStep={activeStep}
            isSubmitting={isSubmitting}
            serverErrors={serverErrors}
          />
        )
      default:
        return null
    }
  }

  if (activeStep === 3) {
    return (
      <SendVerificationEmail email={formData.email || 'user@example.com'} />
    )
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
          {/* LEFT: Vertical Stepper */}
          <Box className={styles.left}>
            <Stepper
              activeStep={activeStep}
              orientation='vertical'
              nonLinear
              connector={<CustomStepperConnector />}
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
          </Box>

          {/* CENTER: Divider */}
          <Divider orientation='vertical' flexItem className={styles.divider} />

          {/* RIGHT: Render different component per step */}
          <Box className={styles.right}>
            <Box className={styles.placeholderBox}>
              {renderStepContent(activeStep)}
            </Box>
          </Box>
        </Box>
      </Box>
    </RegistrationWrapper>
  )
}

export default SignUp
