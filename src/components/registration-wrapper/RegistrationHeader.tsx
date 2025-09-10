import { Box, Typography } from '@mui/material'
import styles from './RegistrationHeader.module.scss'

interface RegistrationHeaderProps {
  heading?: string
  subHeading?: string
}

const RegistrationHeader: React.FC<RegistrationHeaderProps> = ({
  heading,
  subHeading
}) => {
  return (
    <Box>
      <Box className={styles.logoContainer}>
        <img
          src='/assets/monai-logo.svg'
          alt='Website Logo'
          className={styles.logoSize}
        />
      </Box>

      {/* Tagline */}
      {heading && subHeading && (
        <Box className={styles.headerContainer}>
          <Typography variant='h4' align='center'>
            {heading}
          </Typography>
          <Typography
            variant='body1'
            align='center'
            color='var(--text-secondary)'
          >
            {subHeading}
          </Typography>
        </Box>
      )}
    </Box>
  )
}

export default RegistrationHeader
