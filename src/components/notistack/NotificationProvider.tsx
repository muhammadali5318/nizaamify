// File: src/components/Notification/NotificationProvider.tsx

import React from 'react'
import {
  SnackbarProvider,
  useSnackbar,
  type OptionsObject,
  type SnackbarKey
} from 'notistack'
import StyledMaterialDesignContent from '../notistack/StyledMaterialDesignContent'
import CloseIcon from '@mui/icons-material/Close'
import IconButton from '@mui/material/IconButton'

// Types
type NotifyOptions = OptionsObject | undefined

// Ref to hold snackbar functions
const snackRef: {
  enqueueSnackbar?: (msg: React.ReactNode, opts?: NotifyOptions) => void
  closeSnackbar?: (key?: SnackbarKey) => void
} = {}

// Utility: returns a close button if persist is true
const getCloseAction = (persist?: boolean) =>
  persist
    ? (key: SnackbarKey) => (
        <IconButton
          onClick={() => snackRef.closeSnackbar?.(key)}
          size='small'
          sx={{ color: 'white' }}
        >
          <CloseIcon fontSize='small' />
        </IconButton>
      )
    : undefined

// Wires notistack methods into snackRef
const SnackbarUtilsConfigurator: React.FC = () => {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar()

  React.useEffect(() => {
    snackRef.enqueueSnackbar = enqueueSnackbar
    snackRef.closeSnackbar = closeSnackbar
    return () => {
      snackRef.enqueueSnackbar = undefined
      snackRef.closeSnackbar = undefined
    }
  }, [enqueueSnackbar, closeSnackbar])

  return null
}

// Exported notify helpers
export const notify = {
  success: (msg: React.ReactNode, options?: NotifyOptions) =>
    snackRef.enqueueSnackbar?.(msg, {
      variant: 'success',
      ...options,
      action: getCloseAction(options?.persist)
    }),
  error: (msg: React.ReactNode, options?: NotifyOptions) =>
    snackRef.enqueueSnackbar?.(msg, {
      variant: 'error',
      ...options,
      action: getCloseAction(options?.persist)
    }),
  warning: (msg: React.ReactNode, options?: NotifyOptions) =>
    snackRef.enqueueSnackbar?.(msg, {
      variant: 'warning',
      ...options,
      action: getCloseAction(options?.persist)
    }),
  info: (msg: React.ReactNode, options?: NotifyOptions) =>
    snackRef.enqueueSnackbar?.(msg, {
      variant: 'info',
      ...options,
      action: getCloseAction(options?.persist)
    }),
  default: (msg: React.ReactNode, options?: NotifyOptions) =>
    snackRef.enqueueSnackbar?.(msg, {
      variant: 'default',
      ...options,
      action: getCloseAction(options?.persist)
    })
}

// Hook alternative
export const useNotifier = () => {
  const { enqueueSnackbar } = useSnackbar()
  return React.useMemo(
    () => ({
      notify: (
        msg: React.ReactNode,
        variant:
          | 'default'
          | 'success'
          | 'error'
          | 'warning'
          | 'info' = 'default',
        options?: NotifyOptions
      ) =>
        enqueueSnackbar(msg, {
          variant,
          ...options,
          action: getCloseAction(options?.persist)
        })
    }),
    [enqueueSnackbar]
  )
}

// Provider component
const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  return (
    <SnackbarProvider
      maxSnack={3}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      autoHideDuration={5000}
      iconVariant={{
        error: (
          <img
            style={{ paddingRight: 12 }}
            src={'/assets/ErrorOutline.svg'}
            alt={'Error'}
          />
        ),
        success: (
          <img
            style={{ paddingRight: 12 }}
            src={'/assets/verify-icon.svg'}
            alt={'success'}
          />
        )
      }}
      Components={{
        success: StyledMaterialDesignContent,
        error: StyledMaterialDesignContent,
        warning: StyledMaterialDesignContent,
        info: StyledMaterialDesignContent,
        default: StyledMaterialDesignContent
      }}
    >
      <SnackbarUtilsConfigurator />
      {children}
    </SnackbarProvider>
  )
}

export default NotificationProvider
