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
  subHeading?: string
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
  const isVerySmall = useMediaQuery('(max-width:400px)')

  return (
    <Box
      className={className}
      sx={{
        width: '100%',
        overflowX: isMobile ? 'auto' : 'visible'
      }}
    >
      <Stepper
        activeStep={activeStep}
        orientation={isMobile ? 'horizontal' : 'vertical'}
        nonLinear
        connector={
          <CustomStepperConnector
            orientation={isMobile ? 'horizontal' : 'vertical'}
            connectorHeight={isVerySmall ? 24 : connectorHeight}
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
                gap: { xs: isVerySmall ? 0.25 : 0.5, md: 1 },
                minWidth: isVerySmall ? 60 : 'auto'
              }}
              slotProps={{
                stepIcon: {
                  sx: {
                    ...StepperLabelSX,
                    width: isVerySmall ? 20 : 24,
                    height: isVerySmall ? 20 : 24,
                    fontSize: isVerySmall ? '0.65rem' : '0.75rem'
                  }
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
                sx={{
                  fontSize: isVerySmall ? '0.7rem' : '0.8rem',
                  whiteSpace: 'normal',
                  wordBreak: 'break-word'
                }}
              >
                {step.heading}
              </Typography>

              <Typography
                color='var(--color-text-primary)'
                variant='caption'
                sx={{
                  fontSize: isVerySmall ? '0.65rem' : '0.75rem',
                  whiteSpace: 'normal',
                  wordBreak: 'break-word'
                }}
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
