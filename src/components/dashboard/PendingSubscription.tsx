// src/components/dashboard/PendingSubscription.tsx
import React, { ReactNode } from 'react'
import { Button, ButtonProps } from '@mui/material'
import { useNavigate } from 'react-router'
import WarningBanner from './WarningBanner'

interface PendingSubscriptionProps {
  message: ReactNode
  actionLabel: string
  actionPath?: string
  onActionClick?: () => void
  buttonProps?: ButtonProps
}

const PendingSubscription: React.FC<PendingSubscriptionProps> = ({
  message,
  actionLabel,
  actionPath,
  onActionClick,
  buttonProps
}) => {
  const navigate = useNavigate()

  const handleClick = () => {
    if (onActionClick) {
      onActionClick()
      return
    }

    if (actionPath) {
      navigate(actionPath)
    }
  }

  return (
    <WarningBanner
      message={message}
      actions={
        <Button
          variant='contained'
          color='warning'
          size='medium'
          onClick={handleClick}
          {...buttonProps}
        >
          {actionLabel}
        </Button>
      }
    />
  )
}

export default PendingSubscription
