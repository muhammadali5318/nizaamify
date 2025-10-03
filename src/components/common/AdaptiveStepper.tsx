import React from 'react'
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
import {
  CustomStepperConnector,
  StepperLabelSX
} from './CustomStepperConnector'

interface StepData {
  heading: string
  subHeading: string
}

interface AdaptiveStepperProps {
  activeStep: number
  steps: StepData[]
  connectorHeight?: number
  className?: string
}

const AdaptiveStepper: React.FC<AdaptiveStepperProps> = ({
  activeStep,
  steps,
  connectorHeight = 40,
  className
}) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  return (
    <Box className={className}>
      <Stepper
        activeStep={activeStep}
        orientation={isMobile ? 'horizontal' : 'vertical'}
        nonLinear
        connector={
          <CustomStepperConnector
            orientation={isMobile ? 'horizontal' : 'vertical'}
            connectorHeight={connectorHeight}
          />
        }
      >
        {steps?.map((step, index) => (
          <Step key={index} completed={activeStep > index}>
            <StepLabel
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                alignItems: { xs: 'center', md: 'flex-start' },
                textAlign: { xs: 'center', md: 'left' },
                gap: { xs: 0.5, md: 1 }
              }}
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
                sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}
              >
                {step.heading}
              </Typography>
              <Typography
                color='var(--color-text-primary)'
                variant='caption'
                sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}
              >
                {step.subHeading}
              </Typography>
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  )
}

export default AdaptiveStepper
