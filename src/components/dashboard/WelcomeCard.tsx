import { Box, Stack, Typography } from '@mui/material'
import styles from './WelcomeCard.module.scss'
import { ChevronRight } from '@mui/icons-material'
import { LoadingButton } from '@mui/lab'

const WelcomeCard = () => {
  return (
    <span className={styles.WelcomeCardRoot}>
      <Box className={styles.WelcomeCardContainer}>
        <Stack spacing={'6px'}>
          <Typography variant='h4' className='font-weight--700'>
            Welcome to monai!
          </Typography>
          <Typography variant='h6' className='font-weight--500'>
            Track performance, monitor key metrics, and get tailored insights
            for your practice.
          </Typography>
        </Stack>
        <LoadingButton
          className={styles.WelcomeCardButton}
          size='large'
          variant='contained'
          endIcon={<ChevronRight />}
        >
          Get Started
        </LoadingButton>
      </Box>

      <img
        src='/assets/monai-logo-rotated.png'
        alt='monai logo'
        className={styles.WelcomeCardImage}
      />
    </span>
  )
}

export default WelcomeCard
