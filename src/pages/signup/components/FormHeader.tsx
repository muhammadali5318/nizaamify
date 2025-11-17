import { steps as defaultSteps } from '../signUp-config'
import signupRootStyles from '../SignUp.module.scss'
import { Box, Typography } from '@mui/material'
import { FormHeaderProps } from '../types'
import { CONFIG } from 'src/config-global'

const FormHeader: React.FC<FormHeaderProps> = ({
  activeStep,
  showHeading = true
}) => {
  const steps =
    CONFIG.envName === 'dev' ? defaultSteps : defaultSteps.slice(0, -1)
  return (
    <Box className={signupRootStyles.formHeader}>
      <Typography color='var(--color-text-secondary)' variant='subtitle1'>
        Step {activeStep + 1} of {steps.length}
      </Typography>
      {showHeading && (
        <>
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
        </>
      )}
    </Box>
  )
}

export default FormHeader
