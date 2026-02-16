// src/components/AiChatModule.tsx
import {
  Box,
  Drawer,
  IconButton,
  Typography,
  AppBar,
  Toolbar,
  useMediaQuery,
  useTheme
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import bgImage from 'src/assets/gradient-bg-desktop.svg'
import tabMobileBg from 'src/assets/mobile-tab-gradiant.svg'
import ChatShell from './components/chat/ChatShell'
import ChatSidebar from './components/sidebar/ChatSidebar'
import { useState } from 'react'
import { useAppDispatch } from 'src/store/hooks'
import { resetConversation } from 'src/store/slices/chatSlice'

const AiChatModule = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const isBelow900 = useMediaQuery('(max-width:900px)')

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [activeChatTitle, setActiveChatTitle] = useState('New Chat')

  const dispatch = useAppDispatch()

  const handleSelectChat = (id: string | null, title?: string) => {
    if (id === null) {
      // Start a brand new chat: reset redux state (no remount required)
      dispatch(resetConversation())
    }
    setSelectedChatId(id)
    setActiveChatTitle(title || 'New Chat')
    if (isMobile) setIsDrawerOpen(false)
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: {
          xs: 'calc(100vh - 120px)',
          sm: 'calc(100vh - 72px)'
        },
        backgroundImage: `url(${isBelow900 ? tabMobileBg : bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        overflow: 'hidden'
      }}
    >
      {isMobile && (
        <Box
          sx={{
            flexShrink: 0,
            px: '16px',
            pt: '16px',
            pb: '8px',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <AppBar
            position='static'
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              color: 'black',
              boxShadow: '0px 4px 12px rgba(0,0,0,0.05)',
              borderRadius: '16px',
              border: '1px solid #eee'
            }}
          >
            <Toolbar
              variant='dense'
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                minHeight: '48px !important',
                px: '12px !important'
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  overflow: 'hidden'
                }}
              >
                <IconButton
                  edge='start'
                  color='inherit'
                  onClick={() => setIsDrawerOpen(true)}
                  sx={{ mr: 1, ml: 0.1 }}
                >
                  <img
                    src='/assets/layout-navbar-expand.svg'
                    alt='drawer icon'
                  />
                </IconButton>
                <Typography
                  variant='subtitle2'
                  noWrap
                  sx={{
                    fontWeight: 700,
                    maxWidth: '140px',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {selectedChatId ? activeChatTitle : 'New Chat'}
                </Typography>
              </Box>

              <IconButton
                onClick={() => handleSelectChat(null, 'New Chat')}
                size='small'
                sx={{
                  bgcolor: 'black',
                  color: 'white',
                  width: '32px',
                  height: '32px',
                  '&:hover': { bgcolor: '#333' }
                }}
              >
                <AddIcon fontSize='small' />
              </IconButton>
            </Toolbar>
          </AppBar>
        </Box>
      )}

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          flex: 1,
          overflow: 'hidden',
          p: isMobile ? 0 : 2
        }}
      >
        {!isMobile && (
          <Box sx={{ width: 280, flexShrink: 0, height: '100%', mr: 2 }}>
            <ChatSidebar
              selectedChatId={selectedChatId}
              onSelectChat={handleSelectChat}
            />
          </Box>
        )}

        <Drawer
          anchor='left'
          open={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          BackdropProps={{
            sx: { backdropFilter: 'blur(4px)', bgcolor: 'rgba(0,0,0,0.1)' }
          }}
          PaperProps={{
            sx: {
              width: 280,
              border: 'none',
              height: 'calc(100% - 48px)',
              top: '24px',
              left: '24px',
              borderRadius: '24px',
              boxShadow: '0px 10px 30px rgba(0,0,0,0.1)',
              overflow: 'hidden'
            }
          }}
        >
          <ChatSidebar
            selectedChatId={selectedChatId}
            onSelectChat={handleSelectChat}
          />
        </Drawer>

        <Box
          component='main'
          sx={{
            flexGrow: 1,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          {/* DO NOT use a key here — avoid forced remounts */}
          <ChatShell
            selectedChatId={selectedChatId}
            onChatCreated={(id) => setSelectedChatId(id)}
          />
        </Box>
      </Box>
    </Box>
  )
}

export default AiChatModule
