import { Box, Button, List, useMediaQuery } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ChatHistoryItem from './ChatHistoryItem'

const mockHistory = [
  'Expense Optimization',
  'Patient Retention Insights',
  'Revenue Analysis Q4 2024',
  'Benchmark Comparison'
]

const ChatSidebar = () => {
  const isMobile = useMediaQuery('(max-width:900px)')

  if (isMobile) return null

  return (
    <Box
      width={280}
      p={2}
      borderRight='1px solid'
      borderColor='divider'
      borderRadius='24px'
      display='flex'
      flexDirection='column'
      sx={{ backgroundColor: '#F5F5F5' }}
    >
      <Button
        fullWidth
        variant='contained'
        startIcon={<AddIcon />}
        sx={{ mb: 2, backgroundColor: 'black' }}
      >
        New Chat
      </Button>

      <List sx={{ flex: 1 }}>
        {mockHistory.map((item) => (
          <ChatHistoryItem key={item} title={item} />
        ))}
      </List>
    </Box>
  )
}

export default ChatSidebar
