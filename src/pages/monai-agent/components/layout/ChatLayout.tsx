import { Box } from '@mui/material'
import ChatSidebar from '../sidebar/ChatSidebar'
import bgImage from 'src/assets/gradient-bg-desktop.svg'
interface Props {
  children: React.ReactNode
}

const ChatLayout = ({ children }: Props) => {
  return (
    <Box
      display='flex'
      height='100%'
      sx={{ backgroundImage: `url(${bgImage})`, padding: '10px' }}
    >
      <ChatSidebar />

      <Box flex={1} display='flex' flexDirection='column' overflow='hidden'>
        {children}
      </Box>
    </Box>
  )
}

export default ChatLayout
