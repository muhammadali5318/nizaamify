import {
  Box,
  Button,
  List,
  Typography,
  CircularProgress,
  useTheme,
  useMediaQuery
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ChatHistoryItem from './ChatHistoryItem'
import { useAuth } from 'src/context/AuthProvider'
import { useRef, useEffect } from 'react'
import { useFetchRecentChatsInfinite } from '../../hooks/useFetchRecentChats'
import { useQueryClient } from '@tanstack/react-query'

interface Props {
  selectedChatId: string | null
  onSelectChat: (id: string | null, title?: string) => void
  showBottomNewChat?: boolean
}

const ChatSidebar = ({ selectedChatId, onSelectChat }: Props) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  const { data, fetchNextPage, hasNextPage, status } =
    useFetchRecentChatsInfinite(!!accessToken, 20)

  const items =
    data?.pages?.flatMap((p: any) => p.results ?? p.data?.results ?? []) ?? []

  useEffect(() => {
    if (selectedChatId && !items.some((item) => item.id === selectedChatId)) {
      queryClient.invalidateQueries({ queryKey: ['fetchRecentChats'] })
    }
  }, [selectedChatId, items, queryClient])

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) fetchNextPage()
      },
      { threshold: 0.1 }
    )
    if (sentinelRef.current) observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasNextPage, fetchNextPage])

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        p: 2,
        bgcolor: isMobile ? '#fff' : 'rgba(255, 255, 255, 0.7)',
        backdropFilter: isMobile ? 'none' : 'blur(12px)',
        borderRadius: isMobile ? '24px' : '24px',
        border: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.3)',
        boxSizing: 'border-box'
      }}
    >
      <Button
        fullWidth
        variant='contained'
        startIcon={<AddIcon />}
        disabled={selectedChatId === null}
        sx={{
          mb: 2,
          bgcolor: 'black',
          color: 'white',
          borderRadius: '12px',
          py: 1.5,
          '&.Mui-disabled': { bgcolor: '#eee', color: '#999' },
          '&:hover': { bgcolor: '#333' }
        }}
        onClick={() => onSelectChat(null, 'New Chat')}
      >
        New Chat
      </Button>

      <Typography
        variant='caption'
        sx={{ px: 1, mb: 1, fontWeight: 700, color: 'text.secondary' }}
      >
        RECENT CHATS
      </Typography>

      <List
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 0.5,
          // Custom Scrollbar styling
          '&::-webkit-scrollbar': { width: '4px' },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#ccc',
            borderRadius: '10px'
          }
        }}
      >
        {status === 'pending' && items.length === 0 ? (
          <Box display='flex' justifyContent='center' mt={4}>
            <CircularProgress size={24} color='inherit' />
          </Box>
        ) : (
          items.map((item: any) => (
            <ChatHistoryItem
              key={item.id}
              chatMetaData={item}
              onClick={() => onSelectChat(item.id, item.title || item.name)}
              selected={item.id === selectedChatId}
              selectedChatId={selectedChatId}
            />
          ))
        )}
        <div ref={sentinelRef} style={{ height: 10 }} />
      </List>
    </Box>
  )
}

export default ChatSidebar
