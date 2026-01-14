import { Box } from '@mui/material'
import ChatHeader from './ChatHeader'
import ChatInput from './ChatInput'
import SuggestionGrid from '../suggestions/SuggestionGrid'
import ChatMessages from './ChatMessages'
import { useChat } from '../../hooks/useChat'

const ChatShell = () => {
  const { messages, sendMessage, isSending } = useChat()
  const hasMessages = messages.length > 0

  return (
    <Box
      flex={1}
      display='flex'
      flexDirection='column'
      alignItems='center'
      justifyContent='center'
    >
      {!hasMessages ? (
        <>
          <ChatHeader />
        </>
      ) : (
        <ChatMessages messages={messages} />
      )}
      <Box
        mb={2}
        sx={{
          border: '1px solid #EEEEEE',
          padding: 2,
          borderRadius: '24px',
          width: '100%',
          maxWidth: 900,
          backgroundColor: '#FFFFFF'
        }}
      >
        <ChatInput onSend={sendMessage} disabled={isSending} />
        {!hasMessages && <SuggestionGrid />}
      </Box>
    </Box>
  )
}

export default ChatShell
