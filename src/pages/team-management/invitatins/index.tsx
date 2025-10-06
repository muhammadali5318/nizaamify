import { Typography } from '@mui/material'
import React from 'react'
import TeamManagementContentWrapper from '../components/TeamManagementContentWrapper'

const SentInvitations: React.FC = () => (
  <TeamManagementContentWrapper
    imageSrc='/assets/bg-black-clock-icon.svg'
    imageAlt='sent invitation icons'
    title='Sent Invitations'
    subtitle='Manage invitations that have been sent to users'
  >
    <Typography p={2} variant='h6'>
      Sent Invitations
    </Typography>
  </TeamManagementContentWrapper>
)

export default SentInvitations
