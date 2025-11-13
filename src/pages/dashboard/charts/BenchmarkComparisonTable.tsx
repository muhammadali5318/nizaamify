import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Collapse,
  Box,
  Typography,
  useTheme
} from '@mui/material'
import { KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material'
import { useState } from 'react'
import { getUKAvgValue } from '../utils/getUKAvgValue'
import { useActivePractice } from 'src/hooks/useActivePractice'

interface ExpandableBenchmarkTableProps {
  data?: any
}

const ExpandableBenchmarkTable = ({ data }: ExpandableBenchmarkTableProps) => {
  const theme = useTheme()
  const activePracticeData = useActivePractice()
  const activePracticeType =
    activePracticeData?.activePractice?.practice_type || 'Predom. NHS'

  const expenseTypes = data?.current?.expense_types || []
  const categories = data?.current?.categories || []

  const getChildCategories = (parentName: string) =>
    categories.filter(
      (cat: any) =>
        cat.parent_category?.toLowerCase() === parentName.toLowerCase()
    )

  return (
    <Card
      sx={{
        backgroundColor: theme.palette.background.paper,
        boxShadow: 3,
        borderRadius: 3,
        overflow: 'hidden'
      }}
    >
      <CardContent sx={{ p: 0 }}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table
            size='small'
            sx={{
              minWidth: 650,
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
                  Monai benchmarking
                </TableCell>
                <TableCell sx={{ pt: 2 }} align='left'>
                  UK Avg (NHS)
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {expenseTypes.map((type: any) => {
                const children = getChildCategories(type.expense_type)
                return (
                  <ExpandableRow
                    key={type.expense_type}
                    row={type}
                    childCategories={children}
                    activePracticeType={activePracticeType}
                  />
                )
              })}
            </TableBody>
          </Table>
        </Box>
      </CardContent>
    </Card>
  )
}

export default ExpandableBenchmarkTable

// ----------------------------------------------------------
// 🔹 Expandable Row with its own header inside the Collapse
// ----------------------------------------------------------
interface ExpandableRowProps {
  row: any
  childCategories: any[]
  activePracticeType: string
}

const ExpandableRow = ({
  row,
  childCategories,
  activePracticeType
}: ExpandableRowProps) => {
  const [open, setOpen] = useState(false)

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
          {childCategories.length > 0 && (
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
          {parseFloat(row.share_of_total_percent).toFixed(2)}%
        </TableCell>
        <TableCell align='left'>-</TableCell>
        <TableCell align='left'>
          {getUKAvgValue(row.expense_type, activePracticeType)}
        </TableCell>
      </TableRow>

      {/* Expanded Section with Header + Child Rows */}
      {childCategories.length > 0 && (
        <TableRow>
          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
            <Collapse in={open} timeout='auto' unmountOnExit>
              <Box sx={{ m: 1 }}>
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
                      <TableCell align='right'>Monai Benchmarking</TableCell>
                      <TableCell align='right'>UK Avg (NHS)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {childCategories.map((cat: any, idx: number) => (
                      <TableRow
                        key={idx}
                        sx={{
                          backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb'
                        }}
                      >
                        <TableCell />
                        <TableCell component='th' scope='row'>
                          {cat.expense_category}
                        </TableCell>
                        <TableCell align='right'>
                          {parseFloat(cat.share_of_total_percent).toFixed(2)}%
                        </TableCell>
                        <TableCell align='right'>-</TableCell>
                        <TableCell align='right'>
                          {getUKAvgValue(
                            cat.expense_category,
                            activePracticeType
                          )}
                        </TableCell>
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
