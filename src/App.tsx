// src/App.tsx
import { JSX } from 'react'
import { Router } from './router'
import { ThemeProvider } from '@mui/material'
import theme from './theme/muiTheme'
import './styles/global.scss'
import { AuthProvider } from './context/AuthProvider'
import IdleSessionHandler from './components/Idle-session/IdleSessionHandler'
import ErrorBoundary from './components/common/error-boundary'
import { BrowserRouter } from 'react-router'
import NotificationProvider from './components/notistack/NotificationProvider'

function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <ThemeProvider theme={theme}>
            <NotificationProvider>
              <Router />
              <IdleSessionHandler />
            </NotificationProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
