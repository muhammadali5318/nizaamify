// src/components/dashboard/PendingOnboardingBanner.tsx
import React, { useState } from 'react'
import { Button } from '@mui/material'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import WarningBanner from './WarningBanner'
import NominatePracticeManagerDialog from '../nomiate-practice-manage'

const PendingOnboardingBanner: React.FC = () => {
  const [openNominate, setOpenNominate] = useState(false)
  const navigate = useNavigate()

  return (
    <>
      <WarningBanner
        message={
          <>
            <span className='font-weight--700'> Practice onboarding </span>{' '}
            required to access financial insights, benchmarking and document
            analysis.
          </>
        }
        actions={
          <>
            <Button
              onClick={() => setOpenNominate(true)}
              size='medium'
              sx={{ color: 'var(--color-warning-main)' }}
            >
              Nominate manager
            </Button>

            <Button
              variant='contained'
              color='warning'
              size='medium'
              onClick={() => navigate(paths.practiceOnboardingStepper)}
            >
              Complete onboarding
            </Button>
          </>
        }
      />

      <NominatePracticeManagerDialog
        open={openNominate}
        onClose={() => setOpenNominate(false)}
      />
    </>
  )
}

export default PendingOnboardingBanner
