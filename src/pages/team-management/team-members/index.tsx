import { Paper, Typography } from '@mui/material'
import React from 'react'

const TeamMembers: React.FC = () => (
  <Paper elevation={1} sx={{ p: 2 }}>
    <Typography variant='h6'>Team Members</Typography>
    <Typography variant='body2' sx={{ mt: 1 }}>
      Table + filters go here — implement search, role filter, and actions.
    </Typography>
  </Paper>
)

export default TeamMembers
