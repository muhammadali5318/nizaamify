import { BrowserRouter } from 'react-router'
import { Router } from './router'
import { ThemeProvider } from '@mui/material'
import theme from './theme/muiTheme'
import './styles/global.scss'
import { AuthProvider } from './context/AuthProvider'
import IdleSessionHandler from './components/Idle-session/IdleSessionHandler'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider theme={theme}>
          <Router />
          <IdleSessionHandler />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
