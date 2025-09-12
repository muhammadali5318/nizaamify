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

function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary
          onError={() => {
            // Optional: call Sentry here, or your logging util
          }}
          onReset={() => {
            // optional reset actions (clear caches, reset stores)
          }}
        >
          <ThemeProvider theme={theme}>
            <Router />
            <IdleSessionHandler />
          </ThemeProvider>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
