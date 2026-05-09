// File: src/components/Notification/NotificationProvider.tsx

import React from 'react'
import {
  SnackbarProvider,
  useSnackbar,
  type OptionsObject,
  type SnackbarKey
} from 'notistack'
import { useTranslation } from 'react-i18next'
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

// Default auto-dismiss durations per spec §6.
//   - 5s for success / info / warning / default
//   - 8s for error so the user has time to read the failure
const DEFAULT_DURATION = 5000
const ERROR_DURATION = 8000

// Error toasts always show a dismiss button. Other variants only show one
// when the caller passes `persist: true`.
const errorAction = (key: SnackbarKey) => (
  <IconButton
    onClick={() => snackRef.closeSnackbar?.(key)}
    size='small'
    aria-label='Dismiss'
    sx={{ color: 'inherit' }}
  >
    <CloseIcon fontSize='small' />
  </IconButton>
)

// Exported notify helpers
export const notify = {
  success: (msg: React.ReactNode, options?: NotifyOptions) =>
    snackRef.enqueueSnackbar?.(msg, {
      variant: 'success',
      autoHideDuration: DEFAULT_DURATION,
      ...options,
      action: getCloseAction(options?.persist)
    }),
  error: (msg: React.ReactNode, options?: NotifyOptions) =>
    snackRef.enqueueSnackbar?.(msg, {
      variant: 'error',
      autoHideDuration: ERROR_DURATION,
      ...options,
      action: options?.action ?? errorAction
    }),
  warning: (msg: React.ReactNode, options?: NotifyOptions) =>
    snackRef.enqueueSnackbar?.(msg, {
      variant: 'warning',
      autoHideDuration: DEFAULT_DURATION,
      ...options,
      action: getCloseAction(options?.persist)
    }),
  info: (msg: React.ReactNode, options?: NotifyOptions) =>
    snackRef.enqueueSnackbar?.(msg, {
      variant: 'info',
      autoHideDuration: DEFAULT_DURATION,
      ...options,
      action: getCloseAction(options?.persist)
    }),
  default: (msg: React.ReactNode, options?: NotifyOptions) =>
    snackRef.enqueueSnackbar?.(msg, {
      variant: 'default',
      autoHideDuration: DEFAULT_DURATION,
      ...options,
      action: getCloseAction(options?.persist)
    })
}

// Hook alternative — matches the singleton `notify` API so call sites can
// use `const notify = useNotifier(); notify.success(...)` interchangeably.
export const useNotifier = () => {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar()
  return React.useMemo(() => {
    const enqueue =
      (variant: 'default' | 'success' | 'error' | 'warning' | 'info') =>
      (msg: React.ReactNode, options?: NotifyOptions) =>
        enqueueSnackbar(msg, {
          variant,
          autoHideDuration:
            variant === 'error' ? ERROR_DURATION : DEFAULT_DURATION,
          ...options,
          action:
            variant === 'error'
              ? (options?.action ??
                ((key: SnackbarKey) => (
                  <IconButton
                    onClick={() => closeSnackbar(key)}
                    size='small'
                    aria-label='Dismiss'
                    sx={{ color: 'inherit' }}
                  >
                    <CloseIcon fontSize='small' />
                  </IconButton>
                )))
              : getCloseAction(options?.persist)
        })
    return {
      success: enqueue('success'),
      error: enqueue('error'),
      warning: enqueue('warning'),
      info: enqueue('info'),
      default: enqueue('default'),
      // Keep the legacy variant-as-arg API for any older call sites.
      notify: (
        msg: React.ReactNode,
        variant:
          | 'default'
          | 'success'
          | 'error'
          | 'warning'
          | 'info' = 'default',
        options?: NotifyOptions
      ) => enqueue(variant)(msg, options)
    }
  }, [enqueueSnackbar, closeSnackbar])
}

// Provider component
const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  // Mirror toast position in RTL so it appears at the trailing edge in
  // both languages. Reads i18n direction at render time so it stays in
  // sync with language toggles without rebuilding the provider tree.
  const { i18n } = useTranslation()
  const horizontal: 'left' | 'right' = i18n.dir() === 'rtl' ? 'left' : 'right'
  return (
    <SnackbarProvider
      maxSnack={3}
      anchorOrigin={{ vertical: 'top', horizontal }}
      autoHideDuration={5000}
      iconVariant={{
        error: (
          <img
            style={{ paddingInlineEnd: 12 }}
            src={'/assets/ErrorOutline.svg'}
            alt={'Error'}
          />
        ),
        success: (
          <img
            style={{ paddingInlineEnd: 12 }}
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
