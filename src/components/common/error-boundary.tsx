// src/components/ErrorBoundary/ErrorBoundary.tsx
import React from 'react'
import { Box, Button, Typography, Collapse } from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'

type OnErrorFn = (error: unknown, errorInfo?: React.ErrorInfo) => void
type OnResetFn = () => void

interface ErrorBoundaryProps {
  onError?: OnErrorFn
  onReset?: OnResetFn
  children?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: unknown | null
  errorInfo?: React.ErrorInfo | null
  showDetails: boolean
}

function sendErrorToService(error: unknown, errorInfo?: React.ErrorInfo) {
  // Replace with Sentry/your-logger. Keep types generic for safety.

  console.error('Captured error:', error, errorInfo)
}

function stringifyError(err: unknown) {
  if (err instanceof Error)
    return `${err.name}: ${err.message}\n${err.stack ?? ''}`
  try {
    return JSON.stringify(err, null, 2)
  } catch {
    return String(err)
  }
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    }
  }

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    if (typeof this.props.onError === 'function') {
      try {
        this.props.onError(error, errorInfo)
      } catch {
        sendErrorToService(error, errorInfo)
      }
    } else {
      sendErrorToService(error, errorInfo)
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    })
    if (typeof this.props.onReset === 'function') {
      try {
        this.props.onReset()
      } catch {
        /* ignore */
      }
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  toggleDetails = () => {
    this.setState((s) => ({ showDetails: !s.showDetails }))
  }

  renderFallback() {
    const { error, errorInfo, showDetails } = this.state
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3
        }}
      >
        <Box
          sx={{
            maxWidth: 900,
            width: '100%',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            boxShadow: 4,
            bgcolor: 'background.paper'
          }}
        >
          <ErrorOutlineIcon sx={{ fontSize: 56, mb: 1 }} />
          <Typography variant='h6' gutterBottom>
            Oops — something went wrong
          </Typography>
          <Typography variant='body2' sx={{ mb: 2 }}>
            We&apos;re sorry — an unexpected error occurred. You can try
            reloading or retrying.
          </Typography>

          <Box
            sx={{
              display: 'flex',
              gap: 1,
              justifyContent: 'center',
              flexWrap: 'wrap',
              mb: 2
            }}
          >
            <Button variant='contained' onClick={this.handleRetry}>
              Retry
            </Button>
            <Button variant='outlined' onClick={this.handleReload}>
              Reload app
            </Button>
            <Button onClick={this.toggleDetails}>
              {showDetails ? 'Hide details' : 'Show details'}
            </Button>
          </Box>

          <Collapse in={showDetails}>
            <Box
              component='pre'
              sx={{
                textAlign: 'start',
                mt: 2,
                p: 2,
                borderRadius: 1,
                maxHeight: 240,
                overflow: 'auto',
                bgcolor: 'background.default',
                whiteSpace: 'pre-wrap',
                fontSize: 12
              }}
            >
              {error ? stringifyError(error) : 'No error message available.'}
              {'\n\n'}
              {errorInfo?.componentStack}
            </Box>
          </Collapse>
        </Box>
      </Box>
    )
  }

  render() {
    if (this.state.hasError) return this.renderFallback()
    return this.props.children ?? null
  }
}
