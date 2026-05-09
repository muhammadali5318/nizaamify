import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

export type SpinnerSize = 'inline' | 'page'

export interface SpinnerProps {
  /** inline = 16px (used inside buttons), page = 32px (centered loading). */
  size?: SpinnerSize
  /** Override color. Defaults to brand. */
  color?: string
  /** Accessible label, announced as `role='status'`. */
  label?: string
}

const PX: Record<SpinnerSize, number> = { inline: 16, page: 32 }

/** Single sized spinner. Brand-700 by default. */
export function Spinner({
  size = 'inline',
  color = 'var(--text-brand)',
  label = 'Loading'
}: SpinnerProps) {
  return (
    <CircularProgress
      role='status'
      aria-label={label}
      size={PX[size]}
      thickness={4.5}
      sx={{ color }}
    />
  )
}

/** Full-page centered spinner — used by route guards while session loads. */
export function FullPageSpinner() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Spinner size='page' />
    </Box>
  )
}

export default Spinner
