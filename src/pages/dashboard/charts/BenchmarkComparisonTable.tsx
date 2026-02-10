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
  Stack
} from '@mui/material'
import { KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material'
import { useState } from 'react'
import { getUKAvgValue } from '../utils/getUKAvgValue'
import { useActivePractice } from 'src/hooks/useActivePractice'
import benchmarkIcon from '../../../assets/benchmark-comp-icon.svg'
import { downloadBenchmarkCsv } from '../utils/downloadBenchmarkCSV'

/* ---------------------
   Table component
   --------------------- */
interface ExpandableBenchmarkTableProps {
  data?: any
}

const ExpandableBenchmarkTable = ({ data }: ExpandableBenchmarkTableProps) => {
  const theme = useTheme()
  const activePracticeData = useActivePractice()
  const activePracticeType =
    activePracticeData?.activePractice?.practice_type || 'Predom. NHS'

  const expenseTypes = data?.current?.expense_types || []

  return (
    <Box my={2}>
      <Card
        sx={{
          backgroundColor: theme.palette.background.paper,
          boxShadow: 3,
          borderRadius: 3,
          overflow: 'hidden'
        }}
      >
        {/* <CardContent sx={{ p: 0 }}> */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <img src={benchmarkIcon} alt='Benchmark' />
            <Typography variant='h6'>Benchmark Comparison</Typography>
          </Box>{' '}
          <Stack direction='row' spacing={1}>
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

        <Box sx={{ overflowX: 'auto' }}>
          <Table
            size='small'
            sx={{
              '& th': {
                fontWeight: 700,
                fontSize: { xs: '0.8rem', sm: '0.9rem' },
                backgroundColor: '#f9fafb'
              },
              '& td': {
                fontSize: { xs: '0.8rem', sm: '0.9rem' }
              }
            }}
          >
            <TableHead sx={{ backgroundColor: '#F5F5F5' }}>
              <TableRow>
                <TableCell />
                <TableCell sx={{ pt: 2 }}>Category</TableCell>
                <TableCell sx={{ pt: 2 }} align='left'>
                  Your practice value
                </TableCell>
                <TableCell sx={{ pt: 2 }} align='left'>
                  UK Avg (NHS)
                </TableCell>
                <TableCell sx={{ pt: 2 }} align='left'>
                  Monai benchmarking
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {expenseTypes.map((type: any) => {
                if (type.expense_type !== 'Tax Documents') {
                  return (
                    <ExpandableRow
                      key={type.expense_type}
                      row={type}
                      childSubtypes={type.expense_subtypes || []}
                      activePracticeType={activePracticeType}
                    />
                  )
                }
              })}
            </TableBody>
          </Table>
        </Box>
        {/* </CardContent> */}
      </Card>
    </Box>
  )
}

export default ExpandableBenchmarkTable

// ----------------------------------------------------------
// 🔹 Expandable Row with its own header inside the Collapse
// ----------------------------------------------------------
interface ExpandableRowProps {
  row: any
  childSubtypes: any[]
  activePracticeType: string
}

const ExpandableRow = ({
  row,
  childSubtypes,
  activePracticeType
}: ExpandableRowProps) => {
  const [open, setOpen] = useState(false)
  const formatAmountWithPercent = (amount: string, percent: string) => {
    const formattedAmount = Number(amount).toLocaleString('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2
    })

    return `${formattedAmount} (${Number(percent).toFixed(2)}%)`
  }
  return (
    <>
      {/* Parent Row */}
      <TableRow
        sx={{
          '& > *': { borderBottom: 'unset' },
          backgroundColor: '#f1f3f6'
        }}
      >
        <TableCell sx={{ width: '20px' }}>
          {childSubtypes.length > 0 && (
            <IconButton
              aria-label='expand row'
              size='small'
              onClick={() => setOpen(!open)}
            >
              {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
            </IconButton>
          )}
        </TableCell>
        <TableCell component='th' scope='row'>
          <Typography fontWeight={600}>{row.expense_type}</Typography>
        </TableCell>
        <TableCell align='left'>
          {formatAmountWithPercent(row.amount, row.share_of_total_percent)}
        </TableCell>
        <TableCell align='left'>
          {getUKAvgValue(row.expense_type, activePracticeType)}
        </TableCell>
        <TableCell align='left'>-</TableCell>
      </TableRow>

      {/* Expanded Section with Header + Child Rows */}
      {childSubtypes.length > 0 && (
        <TableRow>
          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
            <Collapse in={open} timeout='auto' unmountOnExit>
              <Box sx={{ m: 1, overflowX: 'auto' }}>
                <Typography
                  variant='subtitle2'
                  sx={{
                    fontWeight: 600,
                    mb: 1,
                    color: 'text.secondary'
                  }}
                >
                  {row.expense_type} Breakdown
                </Typography>

                <Table
                  size='small'
                  aria-label={`${row.expense_type} breakdown`}
                  sx={{
                    '& th': {
                      fontWeight: 600,
                      backgroundColor: '#f9fafb'
                    }
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell />
                      <TableCell>Subcategory</TableCell>
                      <TableCell align='right'>Your practice value</TableCell>
                      <TableCell align='right'>UK Avg (NHS)</TableCell>
                      <TableCell align='right'>Monai Benchmarking</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {childSubtypes.map((sub: any, idx: number) => (
                      <TableRow
                        key={idx}
                        sx={{
                          backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb'
                        }}
                      >
                        <TableCell />
                        <TableCell component='th' scope='row'>
                          {sub.expense_subtype}
                        </TableCell>

                        <TableCell align='right'>
                          {/* No percent in subtype → show amount or 0% */}
                          {parseFloat(sub.amount || '0').toFixed(2)}
                        </TableCell>

                        <TableCell align='right'>
                          {getUKAvgValue(
                            sub.expense_subtype,
                            activePracticeType
                          )}
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
