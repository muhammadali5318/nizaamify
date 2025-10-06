import { Typography } from '@mui/material'
import React from 'react'
import TeamManagementContentWrapper from '../components/TeamManagementContentWrapper'

const RolesPermissions: React.FC = () => (
  <TeamManagementContentWrapper
    imageSrc='/assets/bg-black-clock-icon.svg'
    imageAlt='sent invitation icons'
    title='Roles & permissions'
    subtitle='Manage role-based access control for your practice'
  >
    <Typography p={2} variant='h6'>
      Roles and Permissions
    </Typography>
  </TeamManagementContentWrapper>
)

export default RolesPermissions
