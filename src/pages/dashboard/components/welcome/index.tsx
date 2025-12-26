import { Box, Typography } from '@mui/material'
import { useActivePractice } from 'src/hooks/useActivePractice'
import useUserDetails from 'src/hooks/useUserDetails'
import { toTitleCase } from 'src/utils/stringUtils'

const Welcome = () => {
  const { userFullName } = useUserDetails()
  const { activePractice } = useActivePractice()
  return (
    <Box>
      <Typography variant='h5' fontWeight={700}>
        Welcome back, {userFullName}!
      </Typography>
      <Typography variant='body2' color='text.secondary'>
        {activePractice?.practice_name} -{' '}
        <strong>{toTitleCase(activePractice?.practice_type ?? '')}</strong>
      </Typography>
    </Box>
  )
}

export default Welcome
