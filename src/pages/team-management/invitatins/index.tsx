import { Paper, Typography } from '@mui/material'
import React from 'react'

const SentInvitations: React.FC = () => (
  <Paper elevation={1} sx={{ p: 2 }}>
    <Typography variant='h6'>Sent Invitations</Typography>
    <Typography variant='body2' sx={{ mt: 1 }}>
      Show pending invites, resend/cancel actions, and invitation date.
    </Typography>
  </Paper>
)

export default SentInvitations
