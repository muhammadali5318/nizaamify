import { type ReactNode, useState } from 'react'
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { Theme } from '@mui/material/styles'
import { useTheme } from '@mui/material/styles'
import { TableRowSkeleton } from './Skeleton'
import { EmptyState } from './EmptyState'
import { Card } from './Card'

export type ColumnAlign = 'start' | 'center' | 'end'

export interface DataTableColumn<T> {
  id: string
  header: ReactNode
  cell: (row: T) => ReactNode
  /** Use 'end' for numeric/currency columns. Honors RTL via logical alignment. */
  align?: ColumnAlign
  sortable?: boolean
  /** Width hint (CSS dimension). */
  width?: number | string
  /** When set, this column drives the heading text in mobile card mode. */
  cardRole?: 'heading' | 'kv' | 'actions'
  /** Override label shown on the kv pair in mobile card mode (default = header). */
  mobileLabel?: ReactNode
  /** Hide column on mobile (only relevant for `scroll` mobileVariant). */
  hideOnMobile?: boolean
}

export interface DataTableMenuAction<T> {
  label: ReactNode
  onSelect: (row: T) => void
  /** When set, action is rendered with destructive styling. */
  destructive?: boolean
}

export interface DataTableSort {
  columnId: string
  direction: 'asc' | 'desc'
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  /** Stable id per row. */
  getRowId: (row: T) => string
  /** Mobile rendering: stacked cards (default) or horizontal scroll. */
  mobileVariant?: 'cards' | 'scroll'
  /** Show skeleton rows when true. */
  loading?: boolean
  /** Number of skeleton rows shown when loading. */
  loadingRows?: number
  /** Custom empty state. Falls back to EmptyState with default copy. */
  empty?: ReactNode
  onRowClick?: (row: T) => void
  /** Drives the brand-tinted "active" row style. */
  activeRowId?: string
  /** Caller-managed sort state. */
  sort?: DataTableSort
  onSortChange?: (sort: DataTableSort) => void
  /** Optional overflow menu actions, rendered as a kebab on the trailing edge. */
  rowActions?: DataTableMenuAction<T>[]
  /** ARIA caption / accessible name for the table. */
  ariaLabel?: string
}

const ALIGN_TO_LOGICAL: Record<ColumnAlign, 'start' | 'center' | 'end'> = {
  start: 'start',
  center: 'center',
  end: 'end'
}

/**
 * Single table primitive (spec §7.1). Body cells default to 15px via the
 * theme; row height 56px desktop / 64px mobile. Sticky header. Hover and
 * active row states use semantic tokens. Below the `md` breakpoint, rows
 * collapse to stacked Cards via `mobileVariant='cards'` (default).
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  mobileVariant = 'cards',
  loading,
  loadingRows = 6,
  empty,
  onRowClick,
  activeRowId,
  sort,
  onSortChange,
  rowActions,
  ariaLabel
}: DataTableProps<T>) {
  const isMobile = useMediaQuery((t: Theme) => t.breakpoints.down('md'))
  const stackedMobile = isMobile && mobileVariant === 'cards'

  const visibleColumns = stackedMobile
    ? columns
    : columns.filter((c) => !(isMobile && c.hideOnMobile))

  const handleSort = (columnId: string) => {
    if (!onSortChange) return
    const nextDir: 'asc' | 'desc' =
      sort?.columnId === columnId && sort.direction === 'asc' ? 'desc' : 'asc'
    onSortChange({ columnId, direction: nextDir })
  }

  if (!loading && rows.length === 0) {
    return <>{empty ?? <EmptyState title='No results' />}</>
  }

  if (stackedMobile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {loading
          ? Array.from({ length: loadingRows }).map((_, i) => (
              <Card key={`sk-${i}`} variant='default'>
                <TableRowSkeleton columns={2} height={64} />
              </Card>
            ))
          : rows.map((row) => (
              <MobileRowCard
                key={getRowId(row)}
                row={row}
                columns={columns}
                isActive={getRowId(row) === activeRowId}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                actions={rowActions}
              />
            ))}
      </Box>
    )
  }

  return (
    <TableContainer
      sx={{
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-default)',
        backgroundColor: 'var(--surface-base)',
        overflowX: 'auto'
      }}
    >
      <Table aria-label={ariaLabel} stickyHeader>
        <TableHead>
          <TableRow sx={{ height: 48 }}>
            {visibleColumns.map((c) => (
              <TableCell
                key={c.id}
                align={ALIGN_TO_LOGICAL[c.align ?? 'start']}
                sx={{
                  width: c.width,
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                  borderTop: '1px solid var(--border-default)'
                }}
                sortDirection={sort?.columnId === c.id ? sort.direction : false}
              >
                {c.sortable && onSortChange ? (
                  <TableSortLabel
                    active={sort?.columnId === c.id}
                    direction={sort?.columnId === c.id ? sort.direction : 'asc'}
                    onClick={() => handleSort(c.id)}
                  >
                    {c.header}
                  </TableSortLabel>
                ) : (
                  c.header
                )}
              </TableCell>
            ))}
            {rowActions && rowActions.length > 0 && (
              <TableCell
                align='end'
                sx={{ width: 56, position: 'sticky', top: 0, zIndex: 1 }}
              >
                <span aria-hidden>&nbsp;</span>
              </TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading
            ? Array.from({ length: loadingRows }).map((_, i) => (
                <TableRow key={`sk-${i}`} sx={{ height: 56 }}>
                  {visibleColumns.map((c) => (
                    <TableCell key={c.id}>
                      <Box
                        sx={{
                          height: 16,
                          bgcolor: 'var(--surface-muted)',
                          borderRadius: 1
                        }}
                      />
                    </TableCell>
                  ))}
                  {rowActions && rowActions.length > 0 && <TableCell />}
                </TableRow>
              ))
            : rows.map((row) => {
                const id = getRowId(row)
                const active = id === activeRowId
                return (
                  <DesktopRow
                    key={id}
                    row={row}
                    columns={visibleColumns}
                    onClick={onRowClick}
                    active={active}
                    actions={rowActions}
                  />
                )
              })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function DesktopRow<T>({
  row,
  columns,
  onClick,
  active,
  actions
}: {
  row: T
  columns: DataTableColumn<T>[]
  onClick?: (row: T) => void
  active: boolean
  actions?: DataTableMenuAction<T>[]
}) {
  return (
    <TableRow
      hover={Boolean(onClick)}
      onClick={onClick ? () => onClick(row) : undefined}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        height: 56,
        backgroundColor: active ? 'var(--status-brand-bg)' : 'transparent',
        '& > td:first-of-type': active
          ? {
              // text-brand flips light/dark so the active rail reads on
              // both surfaces (was hard-coded var(--brand-700)).
              borderInlineStart: '3px solid var(--text-brand)',
              paddingInlineStart: 'calc(16px - 3px)'
            }
          : {},
        '&:hover': onClick
          ? {
              backgroundColor: active
                ? 'var(--status-brand-bg)'
                : 'var(--surface-muted)'
            }
          : {}
      }}
    >
      {columns.map((c) => (
        <TableCell
          key={c.id}
          align={ALIGN_TO_LOGICAL[c.align ?? 'start']}
          sx={{ width: c.width }}
        >
          {c.cell(row)}
        </TableCell>
      ))}
      {actions && actions.length > 0 && (
        <TableCell
          align='end'
          sx={{ width: 56 }}
          onClick={(e) => e.stopPropagation()}
        >
          <RowActionsMenu row={row} actions={actions} />
        </TableCell>
      )}
    </TableRow>
  )
}

function RowActionsMenu<T>({
  row,
  actions
}: {
  row: T
  actions: DataTableMenuAction<T>[]
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const { direction } = useTheme()
  // The kebab sits at the trailing edge of the row (column align='end' →
  // right in LTR, left in RTL). Menu's anchorOrigin must mirror so it
  // grows toward the leading edge instead of off-screen.
  const horizontal: 'left' | 'right' = direction === 'rtl' ? 'left' : 'right'
  return (
    <>
      <IconButton
        aria-label='Row actions'
        size='small'
        onClick={(e) => {
          e.stopPropagation()
          setAnchor(e.currentTarget)
        }}
      >
        <MoreVertIcon fontSize='small' />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal }}
        transformOrigin={{ vertical: 'top', horizontal }}
      >
        {actions.map((a, i) => (
          <MenuItem
            key={i}
            onClick={() => {
              a.onSelect(row)
              setAnchor(null)
            }}
            sx={a.destructive ? { color: 'var(--error-700)' } : undefined}
          >
            {a.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

function MobileRowCard<T>({
  row,
  columns,
  isActive,
  onClick,
  actions
}: {
  row: T
  columns: DataTableColumn<T>[]
  isActive: boolean
  onClick?: () => void
  actions?: DataTableMenuAction<T>[]
}) {
  const headingCol = columns.find((c) => c.cardRole === 'heading') ?? columns[0]
  const actionsCol = columns.find((c) => c.cardRole === 'actions')
  const kvCols = columns.filter(
    (c) => c !== headingCol && c.cardRole !== 'actions'
  )

  return (
    <Card
      variant='default'
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        backgroundColor: isActive ? 'var(--status-brand-bg)' : undefined,
        borderInlineStart: isActive ? '3px solid var(--text-brand)' : undefined
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant='h3' sx={{ color: 'var(--text-primary)' }}>
            {headingCol.cell(row)}
          </Typography>
        </Box>
        {actions && actions.length > 0 && (
          <Box onClick={(e) => e.stopPropagation()}>
            <RowActionsMenu row={row} actions={actions} />
          </Box>
        )}
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          rowGap: 1,
          columnGap: 1.5
        }}
      >
        {kvCols.map((c) => (
          <Box key={c.id} sx={{ minWidth: 0 }}>
            <Typography
              variant='overline'
              sx={{
                color: 'var(--text-muted)',
                display: 'block',
                lineHeight: 1.2
              }}
            >
              {c.mobileLabel ?? c.header}
            </Typography>
            <Typography variant='body2' sx={{ color: 'var(--text-primary)' }}>
              {c.cell(row)}
            </Typography>
          </Box>
        ))}
      </Box>
      {actionsCol && (
        <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
          {actionsCol.cell(row)}
        </Box>
      )}
    </Card>
  )
}

export default DataTable
