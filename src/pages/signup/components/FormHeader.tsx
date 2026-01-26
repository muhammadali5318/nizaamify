import { steps } from '../signUp-config'
import signupRootStyles from '../SignUp.module.scss'
import { Box, Typography } from '@mui/material'
import { FormHeaderProps } from '../types'

const FormHeader: React.FC<FormHeaderProps> = ({
  activeStep,
  showHeading = true
}) => {
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
