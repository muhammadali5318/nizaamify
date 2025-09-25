import { Box, Button, Typography } from '@mui/material'
import styles from './PendingOnboardingBanner.module.scss'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import NominatePracticeManagerDialog from '../nomiate-practice-manage'
import { useState } from 'react'

const PendingOnboardingBanner = () => {
  const [openNominate, setOpenNominate] = useState(false)
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
          <span className='font-weight--700'> Practice onboarding </span>{' '}
          required to access financial insights, Benchmarking and document
          analysis.
        </Typography>
      </Box>
      <Box className={styles.pendingOnboardingBannerAction}>
        <Button
          onClick={() => setOpenNominate(true)}
          sx={{
            color: 'var(--color-warning-main)'
          }}
          size='medium'
        >
          Nominate manager{' '}
        </Button>
        <Button
          variant='contained'
          color='warning'
          size='medium'
          onClick={() => navigate(paths.practiceOnboardingStepper)}
        >
          Complete onboarding
        </Button>
      </Box>
      <NominatePracticeManagerDialog
        open={openNominate}
        onClose={() => setOpenNominate(false)}
      />
    </Box>
  )
}

export default PendingOnboardingBanner
