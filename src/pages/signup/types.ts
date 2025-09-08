import { SignupStepThreeFormValues } from 'src/schema-validations/signupStepThreeValidations'

export type FormHeaderProps = {
  activeStep: number
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
