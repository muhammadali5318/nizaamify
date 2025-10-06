import { Typography } from '@mui/material'
import React from 'react'
import TeamManagementContentWrapper from '../components/TeamManagementContentWrapper'

const TeamMembers: React.FC = () => (
  <TeamManagementContentWrapper
    imageSrc='/assets/team-members-list.svg'
    imageAlt='team-members-list'
    title='Team members'
    subtitle='Manage your practice team members and their access'
  >
    <Typography p={2} variant='h6'>
      Team members
    </Typography>
  </TeamManagementContentWrapper>
)

export default TeamMembers
