import { Typography } from '@mui/material'

const ChatHeader = () => {
  return (
    <>
      <img
        src='/assets/agent-heading-Icon.svg'
        alt='Monai Agent Logo'
        style={{ width: 60, marginBottom: 16, marginTop: 12 }}
      />
      <Typography variant='h4' fontWeight={600} gutterBottom>
        Hello! How can I help you today?
      </Typography>

      <Typography variant='body2' color='text.secondary' align='center' mb={4}>
        Ask me anything about your practice finances, patient metrics, or get
        insights to grow your business.
      </Typography>
    </>
  )
}

export default ChatHeader
