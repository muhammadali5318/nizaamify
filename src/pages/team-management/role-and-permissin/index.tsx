import { Paper, Typography } from '@mui/material'
import React from 'react'

const RolesPermissions: React.FC = () => (
  <Paper elevation={1} sx={{ p: 2 }}>
    <Typography variant='h6'>Roles & Permissions</Typography>
    <Typography variant='body2' sx={{ mt: 1 }}>
      Role list, permission matrix, and role assignment UI.
    </Typography>
  </Paper>
)

export default RolesPermissions
