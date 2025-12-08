// FILE: src/pages/SignUp/SignUp.tsx
import React, { useCallback, useState } from 'react'
import { Box, Divider, useMediaQuery, useTheme } from '@mui/material'
import RegistrationWrapper from 'src/components/registration-wrapper/RegistrationWrapper'
import styles from './SignUp.module.scss'
import AdaptiveStepper from 'src/components/common/AdaptiveStepper'
import SignupStepOne from './components/SignupStepOne'
import SignupStepTwo from './components/SignupStepTwo'
import SignupStepThree from './components/SignupStepThree'
import {
  generatePayloadForSignUp,
  steps as defaultSteps
} from './signUp-config'
import SendVerificationEmail from './components/SendVerificationEmail'
import RegistrationHeader from 'src/components/registration-wrapper/RegistrationHeader'
import { SignupFormDataSet, SetFormDataSet } from './types'
import { apiClientOpen } from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { sendVerificationEmail } from 'src/services/auth/emailVerification'
import RequestPracticeAssociation from './components/RequestPracticeAssociation/RequestPracticeAssociation'
import { useSearchParams } from 'react-router'
import SignupStepFour from './components/SignupStepFour'
import { CONFIG } from 'src/config-global'

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
  postcode: '',
  practiceEmail: '',
  password: '',
  confirmPassword: '',
  terms: false,
  privacy: false,
  disclaimer: false,
  dataProcessingAgreement: false,
  cookiePolicy: false
}

export type AssociationPayload = {
  first_name: string
  last_name: string
  email: string
  contact_number: string
  role: string
  is_company_director_or_owner: boolean
  practice_id: string
  access_request_reason: string
  practiceName: string
}

const SignUp: React.FC = () => {
  const steps =
    CONFIG.envName === 'dev' ? defaultSteps : defaultSteps.slice(0, -1)
  const [searchParams] = useSearchParams()
  const step = Number(searchParams.get('step') ?? 0)

  const [activeStep, setActiveStep] = useState<number>(step)
  const [newlyCreatedPracticeId, setNewlyCreatedPracticeId] =
    useState<string>('')
  const [formData, setFormDataState] =
    useState<SignupFormDataSet>(initialFormData)

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})

  // new state to hold the association payload to pass into RequestPracticeAssociation
  const [associationPayload, setAssociationPayload] =
    useState<AssociationPayload | null>(null)

  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const { createUser } = endpoints.signup

  const setFormData = useCallback<SetFormDataSet>((patch) => {
    setFormDataState((prev) => ({ ...prev, ...patch }))

    setServerErrors((prev) => {
      if (!patch) return prev
      const newErrors = { ...prev }

      // Always clear general error on any user input
      delete newErrors.general

      // Clear email-related server error when email changes
      if ('email' in patch) {
        delete newErrors.email
      }

      // Clear practice-related server error when any practice field changes
      if (
        'practiceEmail' in patch ||
        'practiceName' in patch ||
        'postcode' in patch
      ) {
        delete newErrors.practice
        delete newErrors.practiceAlreadyExist
        delete newErrors.postcode
      }

      // Clear password error when user edits password or confirmPassword
      if (
        'password' in patch ||
        'confirmPassword' in patch ||
        'password' in newErrors ||
        'confirmPassword' in newErrors
      ) {
        delete newErrors.password
      }

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

  const handleSubmitAll = async (patch?: Partial<SignupFormDataSet>) => {
    if (patch) setFormData(patch)
    const finalForm: SignupFormDataSet = { ...formData, ...(patch || {}) }

    const payload = generatePayloadForSignUp(finalForm)

    setIsSubmitting(true)
    setServerErrors({})
    try {
      const response = await apiClientOpen.post(createUser, payload)
      if (response.status === 201) {
        setActiveStep(4)
        const id = response?.data?.data?.practice?.id
        setNewlyCreatedPracticeId(id)
        sendVerificationEmail({
          email: finalForm?.email,
          practiceId: id
        })
      }
    } catch (err: any) {
      const respData = err?.error
      const parsedErrors: Record<string, string> = {}

      if (respData) {
        // ---- Email error ----
        const userEmailErr =
          respData?.user?.email && Array.isArray(respData?.user?.email)
            ? respData?.user?.email.join(' ')
            : respData?.user?.email
        if (userEmailErr)
          parsedErrors.email =
            'It looks like you already have an account. Try logging in or reset your password if needed.'

        // ---- Practice non-field errors ----
        const practiceErr =
          respData?.practice?.non_field_errors &&
          Array.isArray(respData?.practice?.non_field_errors)
            ? respData?.practice?.non_field_errors.join(' ')
            : respData?.practice?.non_field_errors
        if (practiceErr) parsedErrors.practice = practiceErr

        // ---- Password errors ----
        const userPasswordErr =
          respData?.user?.password && Array.isArray(respData?.user?.password)
            ? respData?.user?.password.join(' ')
            : respData?.user?.password
        if (userPasswordErr)
          parsedErrors.password =
            'Password is too common, please choose a stronger password'

        // ---- Postcode validation error ----
        const postcodeErr =
          respData?.practice?.postcode &&
          Array.isArray(respData?.practice?.postcode)
            ? respData?.practice?.postcode.join(' ')
            : respData?.practice?.postcode
        if (postcodeErr) parsedErrors.postcode = postcodeErr
      }

      // ---- Practice detail error ----
      const practiceDetailErr =
        respData?.practice?.detail && Array.isArray(respData?.practice?.detail)
          ? respData.practice.detail.join(' ')
          : respData?.practice?.detail

      const practiceId =
        respData?.practice?.practice_id &&
        Array.isArray(respData.practice.practice_id)
          ? respData.practice.practice_id[0]
          : respData?.practice?.practice_id

      if (practiceDetailErr) {
        parsedErrors.practiceAlreadyExist = practiceDetailErr
      }

      if (practiceId) {
        // Build the payload exactly as requested
        const payloadForAssociation: AssociationPayload = {
          first_name: finalForm.firstName || '',
          last_name: finalForm.lastName || '',
          email: finalForm.email || '',
          contact_number: finalForm.phone || '',
          role: finalForm.role,
          is_company_director_or_owner: !!finalForm.isPracticeOwnerOrDirector,
          practice_id: String(practiceId),
          access_request_reason: '',
          practiceName: finalForm?.practiceName
        }

        // store and navigate to step 3 where RequestPracticeAssociation will receive it
        setAssociationPayload(payloadForAssociation)
        setActiveStep(3)
      }

      // ---- General fallback ----
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
      case 7:
        return <SignupStepFour />
      default:
        return null
    }
  }

  if (activeStep === 3 || activeStep === 5 || activeStep === 6) {
    return (
      <RequestPracticeAssociation
        setActiveStep={setActiveStep}
        activeStep={activeStep}
        payload={associationPayload}
      />
    )
  }

  if (activeStep === 4) {
    return (
      <SendVerificationEmail
        email={formData.email || 'user@example.com'}
        pracitceId={newlyCreatedPracticeId}
      />
    )
  }

  return (
    <RegistrationWrapper>
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
          marginBottom: 2.5
        }}
      >
        <RegistrationHeader
          heading='Welcome to Monai Tech!'
          subHeading='Let’s get you onboarded!'
        />

        <Box
          className={styles.container}
          sx={{
            maxWidth: activeStep === 7 ? '1300px' : '1000px '
          }}
        >
          {/* LEFT: Adaptive Stepper */}
          <Box className={styles.left}>
            <AdaptiveStepper activeStep={activeStep} steps={steps} />
          </Box>

          {/* CENTER: Divider */}
          <Divider
            orientation={isMobile ? 'horizontal' : 'vertical'}
            flexItem
          />

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
