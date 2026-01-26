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
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './utils/queryClient'
import { FeatureFlagProvider } from './context/FeatureFlagProvider'
import { Provider as ReduxProvider } from 'react-redux'
import { persistor, store } from './store/store'
import { PersistGate } from 'redux-persist/integration/react'

function App(): JSX.Element {
  return (
    <ReduxProvider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <FeatureFlagProvider>
                <ErrorBoundary>
                  <ThemeProvider theme={theme}>
                    <NotificationProvider>
                      <Router />
                      <IdleSessionHandler />
                    </NotificationProvider>
                  </ThemeProvider>
                </ErrorBoundary>
              </FeatureFlagProvider>
            </AuthProvider>
          </QueryClientProvider>
        </BrowserRouter>
      </PersistGate>
    </ReduxProvider>
  )
}

export default App
