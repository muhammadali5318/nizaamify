import { Box, CircularProgress, Typography } from '@mui/material'
import { ChatMessage } from '../../hooks/useChat'

interface Props {
  message: ChatMessage
}

const ChatMessageBubble = ({ message }: Props) => {
  const isUser = message.role === 'user'

  return (
    <Box
      display='flex'
      justifyContent={isUser ? 'flex-end' : 'flex-start'}
      mb={2}
    >
      <Box
        maxWidth='75%'
        px={2}
        py={1.5}
        borderRadius={2}
        bgcolor={isUser ? 'primary.main' : 'grey.100'}
        color={isUser ? 'primary.contrastText' : 'text.primary'}
        display={'flex'}
        alignItems={'center'}
      >
        {message.isStreaming && <CircularProgress size={20} />}
        <Typography variant='body2' whiteSpace='pre-wrap'>
          {' '}
          {message.content}
        </Typography>
      </Box>
    </Box>
  )
}

export default ChatMessageBubble
