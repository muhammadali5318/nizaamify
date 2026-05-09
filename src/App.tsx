import { type JSX, useMemo } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import { CacheProvider } from '@emotion/react'
import { BrowserRouter } from 'react-router'
import { I18nextProvider, useTranslation } from 'react-i18next'
import { QueryClientProvider } from '@tanstack/react-query'
import i18n, { getDirection } from './lib/i18n'
import { getEmotionCache } from './lib/rtlCache'
import { queryClient } from './lib/queryClient'
import { getTheme } from './theme/muiTheme'
import { AuthProvider } from './features/auth/AuthProvider'
import { Router } from './router'
import ErrorBoundary from './components/common/error-boundary'
import NotificationProvider from './components/notistack/NotificationProvider'
import './styles/global.scss'

function ThemedShell(): JSX.Element {
  const { i18n } = useTranslation()
  const direction = getDirection(i18n.language)
  const theme = useMemo(() => getTheme(direction), [direction])
  const cache = useMemo(() => getEmotionCache(direction), [direction])

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <NotificationProvider>
          <Router />
        </NotificationProvider>
      </ThemeProvider>
    </CacheProvider>
  )
}

export default function App(): JSX.Element {
  return (
    <ErrorBoundary>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <ThemedShell />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </I18nextProvider>
    </ErrorBoundary>
  )
}
