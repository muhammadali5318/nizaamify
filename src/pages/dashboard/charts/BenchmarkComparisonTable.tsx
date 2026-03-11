import {
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Collapse,
  Box,
  Typography,
  useTheme,
  Button,
  Stack,
  TableContainer
} from '@mui/material'
import { KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material'
import { useState } from 'react'
import { getUKAvgValue } from '../utils/getUKAvgValue'
import { useActivePractice } from 'src/hooks/useActivePractice'
import benchmarkIcon from '../../../assets/benchmark-comp-icon.svg'
import { downloadBenchmarkCsv } from '../utils/downloadBenchmarkCSV'
import { useAuth } from 'src/context/AuthProvider'
import { useFetchBenchmarkConfigurations } from 'src/hooks/useFetchBenchmarkConfigurations'

interface ExpandableBenchmarkTableProps {
  data?: any
}

export default function ExpandableBenchmarkTable({
  data
}: ExpandableBenchmarkTableProps) {
  const theme = useTheme()
  const { activePractice } = useActivePractice()
  const activePracticeType = activePractice?.practice_type || 'Predom. NHS'
  const expenseTypes = data?.current?.expense_types || []

  return (
    <Box sx={{ my: 3, width: '100%' }}>
      <Card
        elevation={3}
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          width: '100%',
          // Very important: prevent card from expanding beyond viewport
          maxWidth: '100vw',
          boxSizing: 'border-box'
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${theme.palette.divider}`,
            flexWrap: 'wrap',
            gap: 2
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <img
              src={benchmarkIcon}
              alt='Benchmark'
              style={{ width: 28, height: 28 }}
            />
            <Typography variant='h6' component='div'>
              Benchmark Comparison
            </Typography>
          </Box>

          <Stack direction='row' spacing={1.5}>
            <Button
              variant='outlined'
              size='small'
              onClick={() =>
                downloadBenchmarkCsv(data, getUKAvgValue, activePracticeType, {
                  filename: 'expense-benchmark.csv'
                })
              }
            >
              Download CSV
            </Button>
          </Stack>
        </Box>

        {/* This is the key part – scroll only here */}
        <TableContainer
          sx={{
            width: '100%',
            overflowX: 'auto',
            // Important: prevent vertical scroll bleed + smooth iOS scroll
            WebkitOverflowScrolling: 'touch',
            // Visual hint that table is scrollable (optional but recommended)
            '&::-webkit-scrollbar': {
              height: 6
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: theme.palette.grey[400],
              borderRadius: 3
            }
          }}
        >
          <Table
            size='small'
            sx={{
              // Force minimum width so it scrolls on mobile when needed
              minWidth: { xs: 720, sm: 860, md: 960 },
              // Prevent content from collapsing too much
              tableLayout: 'auto',

              '& .MuiTableCell-root': {
                px: { xs: 1.5, sm: 2 },
                py: 1.5
              },

              '& th': {
                fontWeight: 700,
                fontSize: { xs: '0.81rem', sm: '0.875rem' },
                backgroundColor: theme.palette.grey[100],
                whiteSpace: 'nowrap'
              },

              '& td': {
                fontSize: { xs: '0.81rem', sm: '0.875rem' },
                whiteSpace: 'nowrap'
              },

              // Better visual separation for parent rows
              '& tr.parent-row': {
                backgroundColor: theme.palette.grey[50]
              }
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell padding='checkbox' sx={{ width: 48 }} />
                <TableCell>Category</TableCell>
                <TableCell align='right'>Your practice value</TableCell>
                <TableCell align='right'>UK Avg</TableCell>
                <TableCell align='right'>Monai benchmarking</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {expenseTypes.map((type: any) =>
                type.expense_type !== 'Tax Documents' ? (
                  <ExpandableRow
                    key={type.expense_type}
                    row={type}
                    childSubtypes={type.expense_subtypes || []}
                    activePracticeType={activePracticeType}
                  />
                ) : null
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  )
}

// ──────────────────────────────────────────────
// Expandable Row Component
// ──────────────────────────────────────────────

interface ExpandableRowProps {
  row: any
  childSubtypes: any[]
  activePracticeType: string
}

function ExpandableRow({
  row,
  childSubtypes,
  activePracticeType
}: ExpandableRowProps) {
  const [open, setOpen] = useState(false)
  const { accessToken } = useAuth()
  const { data: benchmarkData } = useFetchBenchmarkConfigurations(!!accessToken)

  const currentPracticeBenchmarks =
    benchmarkData?.byType?.[activePracticeType] ?? []
  const benchmark = currentPracticeBenchmarks.find(
    (b: any) => b.expense_category_type === row.expense_type
  )

  const formatValue = (amount: string | number, percent?: string) => {
    const val = Number(amount || 0)
    const formatted = val.toLocaleString('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })
    if (percent) {
      return `${formatted} (${Number(percent).toFixed(1)}%)`
    }
    return formatted
  }

  return (
    <>
      {/* Parent row */}
      <TableRow
        className='parent-row'
        sx={{
          '& > *': { borderBottom: 'unset' }
        }}
      >
        <TableCell padding='checkbox'>
          {childSubtypes.length > 0 && (
            <IconButton size='small' onClick={() => setOpen(!open)}>
              {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
            </IconButton>
          )}
        </TableCell>
        <TableCell component='th' scope='row' sx={{ fontWeight: 600 }}>
          {row.expense_type}
        </TableCell>
        <TableCell align='right'>
          {formatValue(row.amount, row.share_of_total_percent)}
        </TableCell>
        <TableCell align='right'>
          {benchmark
            ? `${benchmark.lower_bound} – ${benchmark.upper_bound}%`
            : '-'}
        </TableCell>
        <TableCell align='right'>-</TableCell>
      </TableRow>

      {/* Expanded content */}
      {childSubtypes.length > 0 && (
        <TableRow>
          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
            <Collapse in={open} timeout='auto' unmountOnExit>
              <Box sx={{ margin: 2, marginLeft: 4 }}>
                <Typography
                  variant='subtitle2'
                  sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}
                >
                  {row.expense_type} Breakdown
                </Typography>

                <Table size='small' sx={{ minWidth: 0 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell padding='checkbox' sx={{ width: 48 }} />
                      <TableCell>Subcategory</TableCell>
                      <TableCell align='right'>Your value</TableCell>
                      <TableCell align='right'>UK Avg</TableCell>
                      <TableCell align='right'>Monai</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {childSubtypes.map((sub: any, idx: number) => (
                      <TableRow
                        key={idx}
                        sx={{
                          backgroundColor:
                            idx % 2 === 0 ? 'action.hover' : 'background.paper'
                        }}
                      >
                        <TableCell padding='checkbox' />
                        <TableCell>{sub.expense_subtype}</TableCell>
                        <TableCell align='right'>
                          {Number(sub.amount || 0).toLocaleString('en-GB', {
                            style: 'currency',
                            currency: 'GBP',
                            minimumFractionDigits: 0
                          })}
                        </TableCell>
                        <TableCell align='right'>
                          {getUKAvgValue(
                            sub.expense_subtype,
                            activePracticeType
                          ) || '-'}
                        </TableCell>
                        <TableCell align='right'>-</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
