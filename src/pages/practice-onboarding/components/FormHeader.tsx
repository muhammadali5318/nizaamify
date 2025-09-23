// src/pages/SignUp/components/FormHeader.tsx
import { steps } from '../practice-onboarding-config'
import signupRootStyles from '../practiceOnboardingFlow.module.scss'
import { Box, Stack, Typography } from '@mui/material'
import { FormHeaderProps } from '../types'
import CircularProgressWithLabel from 'src/components/circular-progress-with-label/CircularProgressWithLabel'

const FormHeader: React.FC<FormHeaderProps> = ({ activeStep }) => {
  const progress = ((activeStep + 1) / steps.length) * 100

  return (
    <Stack
      direction='row'
      justifyContent='space-between'
      alignItems='flex-start'
    >
      <Box className={signupRootStyles.formHeader}>
        <Typography color='var(--color-text-secondary)' variant='subtitle1'>
          Step {activeStep + 1} of {steps.length}
        </Typography>
        <Typography
          variant='h5'
          color='var(--color-primary-black)'
          className='font-weight--700'
        >
          {steps[activeStep].heading}
        </Typography>
        <Typography color='var(--color-text-secondary)' variant='subtitle1'>
          {steps[activeStep].subHeading}
        </Typography>
      </Box>

      <Stack direction='row' sx={{ gap: '6px' }} alignItems='center'>
        <CircularProgressWithLabel value={progress} size={40} thickness={4} />
        <Typography variant='subtitle1' color='var(--color-text-secondary)'>
          Complete
        </Typography>
      </Stack>
    </Stack>
  )
}

export default FormHeader
