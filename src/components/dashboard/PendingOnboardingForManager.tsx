// src/components/dashboard/PendingOnboardingForManager.tsx
import React from 'react'
import { Button } from '@mui/material'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import WarningBanner from './WarningBanner'

const PendingOnboardingForManager: React.FC = () => {
  const navigate = useNavigate()

  return (
    <WarningBanner
      message={
        <>
          <span className='font-weight--700'> Practice onboarding </span> You
          have been nominated by the Practice Owner to complete the practice
          onboarding process.
        </>
      }
      actions={
        <Button
          variant='contained'
          color='warning'
          size='medium'
          onClick={() => navigate(paths.practiceOnboardingStepper)}
        >
          Complete onboarding
        </Button>
      }
    />
  )
}

export default PendingOnboardingForManager
