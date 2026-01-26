import { SignupStepThreeFormValues } from 'src/schema-validations/signupStepThreeValidations'

export type FormHeaderProps = {
  activeStep: number
  showHeading?: boolean
}

export type SignupStepTwoProps = {
  onNext?: () => void
  onBack?: () => void
  activeStep: number
}

export type SignupStepThreeProps = {
  onBack?: () => void
  onSubmit?: (values?: SignupStepThreeFormValues) => void
  setActiveStep: React.Dispatch<React.SetStateAction<number>>
  activeStep: number
}

export type SignupStepOneProps = {
  onNext?: () => void
  activeStep: number
}

export type SignupFormDataSet = {
  // Step 1
  firstName: string
  lastName: string
  role: string
  email: string
  phone: string
  isPracticeOwnerOrDirector: boolean

  // Step 2
  practiceName: string
  street: string
  city: string
  postcode: string
  practiceEmail: string

  // Step 3
  password: string
  confirmPassword: string
  terms: boolean
  privacy: boolean
  disclaimer: boolean
  dataProcessingAgreement: boolean
  cookiePolicy: boolean
}

export type SetFormDataSet = (patch: Partial<SignupFormDataSet>) => void

export type StepPropsBase = {
  formData: SignupFormDataSet
  setFormData: SetFormDataSet
  onNext?: (patch?: Partial<SignupFormDataSet>) => void
  onBack?: () => void
  onSubmit?: (patch?: Partial<SignupFormDataSet>) => void
  activeStep: number
}
