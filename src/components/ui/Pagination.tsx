import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import MuiPagination from '@mui/material/Pagination'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { Theme } from '@mui/material/styles'

export interface PaginationProps {
  /** Current 1-indexed page. */
  page: number
  /** Total result count across all pages. */
  total: number
  /** Items per page. */
  pageSize: number
  onChange: (page: number) => void
  /** Hide the "Showing N–M of T" text (rare). */
  hideSummary?: boolean
}

/**
 * List pagination with summary text (spec §7.1). Page-jump UI shown on
 * desktop only; mobile gets prev/next arrows. Caller is responsible for
 * server-side fetch — this component only renders.
 */
export function Pagination({
  page,
  total,
  pageSize,
  onChange,
  hideSummary
}: PaginationProps) {
  const isDesktop = useMediaQuery((t: Theme) => t.breakpoints.up('md'))
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
        py: 2,
        px: { xs: 1, md: 0 }
      }}
    >
      {!hideSummary && (
        <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
          Showing {from}–{to} of {total}
        </Typography>
      )}
      <MuiPagination
        page={page}
        count={pageCount}
        onChange={(_, p) => onChange(p)}
        size={isDesktop ? 'medium' : 'small'}
        siblingCount={isDesktop ? 1 : 0}
        boundaryCount={isDesktop ? 1 : 0}
        showFirstButton={isDesktop}
        showLastButton={isDesktop}
        shape='rounded'
        color='primary'
      />
    </Box>
  )
}

export default Pagination
