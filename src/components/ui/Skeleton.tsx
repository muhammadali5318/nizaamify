import MuiSkeleton, {
  type SkeletonProps as MuiSkeletonProps
} from '@mui/material/Skeleton'
import Box from '@mui/material/Box'

export type SkeletonProps = MuiSkeletonProps

/** Shape-preserving loading placeholder. Defaults to text variant. */
export function Skeleton({ variant = 'text', sx, ...rest }: SkeletonProps) {
  return (
    <MuiSkeleton
      variant={variant}
      animation='wave'
      sx={[
        { bgcolor: 'var(--surface-muted)' },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
      ]}
      {...rest}
    />
  )
}

export interface TableRowSkeletonProps {
  columns: number
  /** Row height. 56 desktop / 64 mobile per spec §7.1. */
  height?: number
}

/** Pre-shaped row used by DataTable's loading state. */
export function TableRowSkeleton({
  columns,
  height = 56
}: TableRowSkeletonProps) {
  return (
    <Box
      role='presentation'
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        alignItems: 'center',
        height,
        px: 2,
        gap: 2,
        borderBottom: '1px solid var(--border-subtle)'
      }}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          variant='text'
          width='80%'
          sx={{ fontSize: '0.9375rem' }}
        />
      ))}
    </Box>
  )
}

export default Skeleton
