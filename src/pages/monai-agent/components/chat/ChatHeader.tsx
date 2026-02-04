import { Stack, Typography } from '@mui/material'

const ChatHeader = () => {
  return (
    <Stack alignItems='center' spacing={2} px={2}>
      <img
        src='/assets/agent-heading-Icon.svg'
        alt='Monai Agent Logo'
        className='icon-dimension--48'
      />

      <Stack gap={0.5} maxWidth={500} width='100%'>
        <Typography variant='h4' fontWeight={700} textAlign='center'>
          Hello! How can I help you today?
        </Typography>

        <Typography variant='body2' color='text.secondary' textAlign='center'>
          Ask me anything about your practice finances, patient metrics, or get
          insights to grow your business.
        </Typography>
      </Stack>
    </Stack>
  )
}

export default ChatHeader
