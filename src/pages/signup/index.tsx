import React, { useState } from 'react'
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
import { steps } from './signUp-config'
import SendVerificationEmail from './components/SendVerificationEmail'
import RegistrationHeader from 'src/components/registration-wrapper/RegistrationHeader'

const SignUp: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(0)

  const handleNext = () =>
    setActiveStep((s) => Math.min(steps.length - 1, s + 1))
  const handleBack = () => setActiveStep((s) => Math.max(0, s - 1))
  // const handleReset = () => setActiveStep(0)
  // const isLast = activeStep === steps.length - 1

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return <SignupStepOne onNext={handleNext} activeStep={activeStep} />
      case 1:
        return (
          <SignupStepTwo
            onNext={handleNext}
            onBack={handleBack}
            activeStep={activeStep}
          />
        )
      case 2:
        return (
          <SignupStepThree
            onBack={handleBack}
            onSubmit={() => alert('submit placeholder')}
            setActiveStep={setActiveStep}
            activeStep={activeStep}
          />
        )
      default:
        return null
    }
  }

  if (activeStep === 3) {
    return <SendVerificationEmail email='Sarah.Daniel@example.com' />
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
                      color={`${activeStep >= index ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'}`}
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
