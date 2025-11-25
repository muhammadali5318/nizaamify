// src/components/dashboard/PendingSubscription.tsx
import React from 'react'
import { Button } from '@mui/material'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import WarningBanner from './WarningBanner'

const PendingSubscription: React.FC = () => {
  const navigate = useNavigate()

  return (
    <WarningBanner
      message={
        <>
          You need to select a <strong> subscription plan </strong> to
          completely unlock the MonAI platform and access all features.
        </>
      }
      actions={
        <Button
          variant='contained'
          color='warning'
          size='medium'
          onClick={() => navigate(paths.billing)}
        >
          Choose plan
        </Button>
      }
    />
  )
}

export default PendingSubscription
