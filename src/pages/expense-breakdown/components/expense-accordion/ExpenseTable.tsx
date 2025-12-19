import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  IconButton,
  Collapse,
  Box,
  Typography,
  Chip
} from '@mui/material'
import { ArrowDropDown, ArrowDropUp } from '@mui/icons-material'
import { useState } from 'react'
import RemoveRedEyeOutlinedIcon from '@mui/icons-material/RemoveRedEyeOutlined'
import DocumentDetailsModal from '../document-details-modal'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { RangeISO } from 'src/components/date-range-selector'
import { toApiDate } from '../../hooks/useFetchExpenseBreakdown'
import { formatAmountWithCommas } from 'src/utils/stringUtils'

interface ExpenseBreakdownTableProps {
  data?: any
  dateRange?: RangeISO
  total?: any
}

const columnWidths = {
  col1: '40px',
  col2: '30%',
  col3: '30%',
  col4: '40%'
}

const ExpenseBreakdownTable = ({
  data,
  dateRange,
  total
}: ExpenseBreakdownTableProps) => {
  const categories = data || []

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table
        size='small'
        sx={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: '0 6px',
          marginTop: '-6px',
          '& th': {
            border: 'none'
          },
          '& td': {
            border: 'none'
          }
        }}
      >
        {/* Remove TableHead completely */}
        <TableBody>
          {/* MAIN HEADER - now styled exactly like other card rows */}
          <TableRow
            sx={{
              background: '#fff',
              borderRadius: '12px',
              '& > td': {
                padding: '12px 16px',
                border: 'none',
                fontWeight: 600,
                fontSize: '14px',
                '&:first-of-type': {
                  borderTopLeftRadius: '12px',
                  borderBottomLeftRadius: '12px'
                },
                '&:last-of-type': {
                  borderTopRightRadius: '12px',
                  borderBottomRightRadius: '12px'
                }
              }
            }}
          >
            <TableCell sx={{ width: columnWidths.col1 }} />
            <TableCell sx={{ width: columnWidths.col2 }}>
              {' '}
              <Typography variant='subtitle2' fontWeight={500}>
                Subcategory
              </Typography>
            </TableCell>
            <TableCell sx={{ width: columnWidths.col3 }} align='left'>
              <Typography variant='subtitle2' fontWeight={500}>
                Amount
              </Typography>
            </TableCell>
            <TableCell sx={{ width: columnWidths.col4 }} align='left'>
              <Typography variant='subtitle2' fontWeight={500}>
                Effecting Documents
              </Typography>
            </TableCell>
          </TableRow>

          {/* PARENT ROWS */}
          {categories.map((type: any) => {
            return (
              <ExpandableRow
                key={type.expense_type}
                row={type}
                childCategories={type}
                dateRange={dateRange}
              />
            )
          })}
        </TableBody>
      </Table>
      <Box
        display={'flex'}
        padding={'8px 0px'}
        alignItems={'center'}
        alignSelf={'stretch'}
      >
        <Typography width={'423px'} variant='subtitle1' fontWeight={700}>
          Total Business Operations
        </Typography>
        <Typography variant='h5' fontWeight={700}>
          £{total}
        </Typography>
      </Box>
    </Box>
  )
}

export default ExpenseBreakdownTable

// ----------------------------------------------------------
//                EXPANDABLE ROW
// ----------------------------------------------------------
interface ExpandableRowProps {
  row: any
  childCategories: any[]
  dateRange: RangeISO
}

const ExpandableRow = ({
  row,
  childCategories,
  dateRange
}: ExpandableRowProps) => {
  const [open, setOpen] = useState(false)
  const { activePracticeId } = useActivePractice()
  const [openDocumentDetails, setOpenDocumentDetails] = useState<boolean>(false)
  const [downloadableDocuments, setDownloadableDocuments] = useState()
  const handleDocumentDetails = async (type: string) => {
    const response = await apiClient.get(
      endpoints.documents.expenseBreakdownDocuments(activePracticeId ?? ''),
      {
        params: {
          start_date: toApiDate(dateRange.start),
          end_date: toApiDate(dateRange.end),
          sub_cat: type
        }
      }
    )
    setDownloadableDocuments(response?.data?.data)
    setOpenDocumentDetails(true)
  }
  return (
    <>
      {/* PARENT ROW */}
      <TableRow
        sx={{
          background: '#FFF',
          display: 'table-row',
          marginBottom: open ? '0px' : '6px',
          '& > td': {
            padding: '12px 16px',
            '&:first-of-type': {
              borderTopLeftRadius: '12px',
              borderBottomLeftRadius: '12px'
            },
            '&:last-of-type': {
              borderTopRightRadius: '12px',
              borderBottomRightRadius: '12px'
            }
          },
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* col 1 */}
        <TableCell sx={{ width: columnWidths.col1, padding: '0px !important' }}>
          {childCategories?.expense_sub_categories?.length > 0 && (
            <IconButton
              aria-label='expand row'
              size='small'
              onClick={() => setOpen(!open)}
            >
              {open ? <ArrowDropUp /> : <ArrowDropDown />}
            </IconButton>
          )}
        </TableCell>

        {/* col 2 */}
        <TableCell sx={{ width: columnWidths.col2 }} component='th'>
          <Box display={'flex'} gap={'10px'}>
            <Typography variant='subtitle2' fontWeight={500}>
              {row?.expense_subtype}
            </Typography>
            {childCategories?.expense_sub_categories?.length > 0 && (
              <Chip
                label={'5 subcategories'}
                size='small'
                sx={{
                  border: '1px solid #BEDBFF',
                  background: '#DBEAFE',
                  color: '#1447E6'
                }}
                variant='outlined'
              />
            )}
          </Box>
        </TableCell>

        {/* col 3 */}
        <TableCell sx={{ width: columnWidths.col3 }} align='left'>
          <Typography variant='subtitle2' fontWeight={500}>
            £{formatAmountWithCommas(row?.total_amount)}
          </Typography>
        </TableCell>

        {/* col 4 */}
        <TableCell sx={{ width: columnWidths.col4 }} align='left'>
          <IconButton
            size='small'
            aria-label='View Expense details'
            // onClick={() => setOpenDocumentDetails(true)}
            onClick={() => handleDocumentDetails(row?.expense_subtype)}
          >
            <RemoveRedEyeOutlinedIcon fontSize='small' />
          </IconButton>
        </TableCell>
      </TableRow>

      {/* CHILD WRAPPER ROW */}
      <TableRow>
        <TableCell colSpan={4} sx={{ padding: 0, border: 'none' }}>
          <Collapse in={open} timeout='auto' unmountOnExit>
            <Box
              sx={{
                background: '#FFFFFF',
                marginTop: '-6px',
                padding: '10px 10px 10px 10px',
                margin: '-15px 0px 0px 0px',
                borderBottomLeftRadius: '12px',
                borderBottomRightRadius: '12px',
                overflow: 'hidden'
              }}
            >
              <Table
                size='small'
                sx={{
                  width: '100%',
                  borderCollapse: 'separate',
                  borderSpacing: '0 10px',
                  marginTop: '-10px'
                }}
              >
                <TableBody>
                  {/* CHILD HEADER */}
                  <TableRow
                    sx={{
                      background: '#F0F0F0',
                      borderRadius: '12px',
                      '& > td': {
                        padding: '7px 16px',
                        border: 'none',
                        fontWeight: 600,
                        fontSize: '14px',
                        '&:first-of-type': {
                          borderTopLeftRadius: '12px',
                          borderBottomLeftRadius: '12px'
                        },
                        '&:last-of-type': {
                          borderTopRightRadius: '12px',
                          borderBottomRightRadius: '12px'
                        }
                      }
                    }}
                  >
                    <TableCell sx={{ width: columnWidths.col1 }} />
                    <TableCell sx={{ width: columnWidths.col2 }}>
                      <Typography variant='subtitle2' fontWeight={500}>
                        Link items
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ width: columnWidths.col3 }}>
                      <Typography variant='subtitle2' fontWeight={500}>
                        Amount
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ width: columnWidths.col4 }}>
                      <Typography variant='subtitle2' fontWeight={500}>
                        Effecting Documents
                      </Typography>
                    </TableCell>
                  </TableRow>

                  {/* CHILD DATA ROWS */}
                  {childCategories?.expense_sub_categories?.map(
                    (cat: any, idx: number) => {
                      const [key, value] = Object.entries(cat)[0]

                      return (
                        <TableRow
                          key={idx}
                          sx={{
                            background: '#F0F0F0',
                            borderRadius: '12px',
                            '& > td': {
                              padding: '12px 16px',
                              border: 'none',
                              '&:first-of-type': {
                                borderTopLeftRadius: '12px',
                                borderBottomLeftRadius: '12px'
                              },
                              '&:last-of-type': {
                                borderTopRightRadius: '12px',
                                borderBottomRightRadius: '12px'
                              }
                            }
                          }}
                        >
                          <TableCell
                            sx={{
                              width: columnWidths.col1,
                              padding: '0px !important'
                            }}
                          >
                            <IconButton size='small' disabled />
                          </TableCell>
                          <TableCell
                            sx={{ width: columnWidths.col2, fontWeight: 500 }}
                          >
                            {key}
                          </TableCell>
                          <TableCell
                            sx={{ width: columnWidths.col3, fontWeight: 500 }}
                          >
                            £{formatAmountWithCommas(value)}
                          </TableCell>
                          <TableCell sx={{ width: columnWidths.col4 }}>
                            <IconButton
                              size='small'
                              aria-label='View Expense details'
                              // onClick={() => setOpenDocumentDetails(true)}
                              onClick={() => {
                                handleDocumentDetails(key)
                              }}
                            >
                              <RemoveRedEyeOutlinedIcon fontSize='small' />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      )
                    }
                  )}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
      <DocumentDetailsModal
        open={openDocumentDetails}
        onClose={() => setOpenDocumentDetails(false)}
        downloadableDocuments={downloadableDocuments}
      />
    </>
  )
}
