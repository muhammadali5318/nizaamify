import React, { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  IconButton,
  Collapse,
  Box,
  Typography,
  Chip,
  useTheme,
  useMediaQuery
} from '@mui/material'
import { ArrowDropDown, ArrowDropUp } from '@mui/icons-material'
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
  title?: string
}

const ExpenseBreakdownTable = ({
  data,
  dateRange,
  total,
  title
}: ExpenseBreakdownTableProps) => {
  const categories = data || []

  // theme & breakpoint helpers used to adapt spacing/font sizes on small screens
  const theme = useTheme()
  const isSmDown = useMediaQuery(theme.breakpoints.down('sm'))

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table
        size='small'
        sx={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: '0 6px',
          marginTop: '-6px',
          '& th': { border: 'none' },
          '& td': { border: 'none' }
        }}
      >
        <TableBody>
          {/* MAIN HEADER */}
          <TableRow
            sx={{
              background: '#fff',
              borderRadius: '12px',
              '& > td': {
                padding: isSmDown ? '8px 10px' : '12px 16px',
                border: 'none',
                fontWeight: 600,
                fontSize: isSmDown ? '13px' : '14px',
                whiteSpace: 'normal',
                wordBreak: 'break-word',
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
                width: isSmDown ? '36px' : '40px',
                padding: '0px !important'
              }}
            />
            <TableCell sx={{ width: { xs: '50%', sm: '30%' } }}>
              <Typography variant='subtitle2' fontWeight={500} noWrap={false}>
                Subcategory
              </Typography>
            </TableCell>
            <TableCell sx={{ width: { xs: '30%', sm: '30%' } }} align='left'>
              <Typography variant='subtitle2' fontWeight={500}>
                Amount
              </Typography>
            </TableCell>
            <TableCell sx={{ width: { xs: '20%', sm: '40%' } }} align='left'>
              <Typography variant='subtitle2' fontWeight={500}>
                Effecting Documents
              </Typography>
            </TableCell>
          </TableRow>

          {/* PARENT ROWS */}
          {categories.map((type: any) => (
            <ExpandableRow
              key={type.expense_type}
              row={type}
              childCategories={type}
              dateRange={dateRange}
            />
          ))}
        </TableBody>
      </Table>

      {/* TOTAL SECTION - responsive stacking on small screens */}
      <Box
        display={'flex'}
        padding={isSmDown ? '8px 4px' : '8px 0px'}
        alignItems={isSmDown ? 'flex-start' : 'center'}
        alignSelf={'stretch'}
        gap={isSmDown ? 1 : 2}
        flexDirection={isSmDown ? 'column' : 'row'}
      >
        <Typography
          width={isSmDown ? '100%' : '423px'}
          variant='subtitle1'
          fontWeight={700}
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          Total {title}
        </Typography>
        <Typography variant={isSmDown ? 'h6' : 'h5'} fontWeight={700}>
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
  const [downloadableDocuments, setDownloadableDocuments] = useState<any>()
  const theme = useTheme()
  const isSmDown = useMediaQuery(theme.breakpoints.down('sm'))

  const handleDocumentDetails = async (type: string) => {
    try {
      const response = await apiClient.get(
        endpoints.documents.expenseBreakdownDocuments(activePracticeId ?? ''),
        {
          params: {
            start_date: toApiDate(dateRange?.start),
            end_date: toApiDate(dateRange?.end),
            sub_cat: type
          }
        }
      )
      setDownloadableDocuments(response?.data?.data)
      setOpenDocumentDetails(true)
    } catch {
      // swallow - keep behavior same
      setDownloadableDocuments(undefined)
      setOpenDocumentDetails(true)
    }
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
            padding: isSmDown ? '8px 10px' : '12px 16px',
            '&:first-of-type': {
              borderTopLeftRadius: '12px',
              borderBottomLeftRadius: '12px'
            },
            '&:last-of-type': {
              borderTopRightRadius: '12px',
              borderBottomRightRadius: '12px'
            },
            whiteSpace: 'normal',
            wordBreak: 'break-word'
          },
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* col 1 */}
        <TableCell
          sx={{ width: isSmDown ? '36px' : '40px', padding: '0px !important' }}
        >
          {childCategories?.expense_sub_categories?.length > 0 && (
            <IconButton
              aria-label='expand row'
              size={isSmDown ? 'small' : 'small'}
              onClick={() => setOpen(!open)}
              sx={{
                transform: open ? 'rotate(0deg)' : 'rotate(0deg)',
                padding: isSmDown ? '4px' : undefined
              }}
            >
              {open ? <ArrowDropUp /> : <ArrowDropDown />}
            </IconButton>
          )}
        </TableCell>

        {/* col 2 */}
        <TableCell sx={{ width: { xs: '50%', sm: '30%' } }} component='th'>
          <Box
            display={'flex'}
            gap={'10px'}
            alignItems={'center'}
            flexWrap='wrap'
          >
            <Typography
              variant='subtitle2'
              fontWeight={500}
              sx={{ fontSize: isSmDown ? '13px' : '14px' }}
            >
              {row?.expense_subtype}
            </Typography>
            {childCategories?.expense_sub_categories?.length > 0 && (
              <Chip
                label={`${childCategories?.expense_sub_categories?.length} subcategories`}
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
        <TableCell sx={{ width: { xs: '30%', sm: '30%' } }} align='left'>
          <Typography
            variant='subtitle2'
            fontWeight={500}
            sx={{ fontSize: isSmDown ? '13px' : '14px' }}
          >
            £{formatAmountWithCommas(row?.total_amount)}
          </Typography>
        </TableCell>

        {/* col 4 */}
        <TableCell sx={{ width: { xs: '20%', sm: '40%' } }} align='left'>
          <IconButton
            size={isSmDown ? 'small' : 'small'}
            aria-label='View Expense details'
            onClick={() => handleDocumentDetails(row?.expense_subtype)}
            sx={{ padding: isSmDown ? '6px' : undefined }}
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
                padding: isSmDown ? '8px 8px' : '10px',
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
                        padding: isSmDown ? '6px 10px' : '7px 16px',
                        border: 'none',
                        fontWeight: 600,
                        fontSize: isSmDown ? '13px' : '14px',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
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
                    <TableCell sx={{ width: isSmDown ? '36px' : '40px' }} />
                    <TableCell sx={{ width: { xs: '50%', sm: '30%' } }}>
                      <Typography variant='subtitle2' fontWeight={500}>
                        Link items
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ width: { xs: '30%', sm: '30%' } }}>
                      <Typography variant='subtitle2' fontWeight={500}>
                        Amount
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ width: { xs: '20%', sm: '40%' } }}>
                      <Typography variant='subtitle2' fontWeight={500}>
                        Effecting Documents
                      </Typography>
                    </TableCell>
                  </TableRow>

                  {/* CHILD DATA ROWS */}
                  {childCategories?.expense_sub_categories?.map(
                    (cat: any, idx: number) => {
                      const [key, value] = Object.entries(cat)[0] || []

                      return (
                        <TableRow
                          key={idx}
                          sx={{
                            background: '#F0F0F0',
                            borderRadius: '12px',
                            '& > td': {
                              padding: isSmDown ? '8px 10px' : '12px 16px',
                              border: 'none',
                              whiteSpace: 'normal',
                              wordBreak: 'break-word',
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
                              width: isSmDown ? '36px' : '40px',
                              padding: '0px !important'
                            }}
                          >
                            <IconButton
                              size='small'
                              disabled
                              sx={{ padding: isSmDown ? '4px' : undefined }}
                            />
                          </TableCell>
                          <TableCell
                            sx={{
                              width: { xs: '50%', sm: '30%' },
                              fontWeight: 500
                            }}
                          >
                            {key}
                          </TableCell>
                          <TableCell
                            sx={{
                              width: { xs: '30%', sm: '30%' },
                              fontWeight: 500
                            }}
                          >
                            £{formatAmountWithCommas(value)}
                          </TableCell>
                          <TableCell sx={{ width: { xs: '20%', sm: '40%' } }}>
                            <IconButton
                              size={isSmDown ? 'small' : 'small'}
                              aria-label='View Expense details'
                              onClick={() => {
                                handleDocumentDetails(key)
                              }}
                              sx={{ padding: isSmDown ? '6px' : undefined }}
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
