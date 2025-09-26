import { Box, Button, Typography } from '@mui/material'
import styles from './PendingOnboardingBanner.module.scss'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'

const PendingOnboardingForManager = () => {
  const navigate = useNavigate()

  return (
    <Box className={styles.pendingOnboardingBannerRoot}>
      <Box className={styles.pendingOnboardingBannerHeader}>
        <img
          className='icon-dimension--32'
          src='/assets/warning.svg'
          alt='warning icon'
        />
        <Typography variant='subtitle1' color='var(--color-warning-dark)'>
          <span className='font-weight--700'> Practice onboarding </span> You
          have been nominated by the Practice Owner to complete the practice
          onboarding process.
        </Typography>
      </Box>
      <Box className={styles.pendingOnboardingBannerAction}>
        <Button
          variant='contained'
          color='warning'
          size='medium'
          onClick={() => navigate(paths.practiceOnboardingStepper)}
        >
          Complete onboarding
        </Button>
      </Box>
    </Box>
  )
}

export default PendingOnboardingForManager
