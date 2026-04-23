import { JSX } from 'react'
import { ThemeProvider } from '@mui/material'
import { BrowserRouter } from 'react-router'
import { Router } from './router'
import theme from './theme/muiTheme'
import './styles/global.scss'
import ErrorBoundary from './components/common/error-boundary'
import NotificationProvider from './components/notistack/NotificationProvider'

function App(): JSX.Element {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ThemeProvider theme={theme}>
          <NotificationProvider>
            <Router />
          </NotificationProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}

export default App
