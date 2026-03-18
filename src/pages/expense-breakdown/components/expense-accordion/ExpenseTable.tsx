// (paste this into your parent file, replacing the previous content)
import React, { useEffect, useState } from 'react'
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
  dateRange: RangeISO
  total?: any
  title?: string
  expanded?: boolean
}

const ExpenseBreakdownTable: React.FC<ExpenseBreakdownTableProps> = ({
  data,
  dateRange,
  total,
  title,
  expanded
}) => {
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
                Source Documents
              </Typography>
            </TableCell>
          </TableRow>

          {/* PARENT ROWS */}
          {categories.map((type: any, idx: number) => (
            <ExpandableRow
              key={type?.expense_subtype ?? idx}
              row={type}
              childCategories={type}
              dateRange={dateRange}
              expanded={expanded}
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
  childCategories: any
  dateRange: RangeISO
  expanded?: boolean
}

const ExpandableRow: React.FC<ExpandableRowProps> = ({
  row,
  childCategories,
  dateRange,
  expanded
}) => {
  const [open, setOpen] = useState(false)
  const { activePracticeId } = useActivePractice()
  const [openDocumentDetails, setOpenDocumentDetails] = useState<boolean>(false)

  // store current subcategory when opening modal so pagination calls have context
  const [currentSubCat, setCurrentSubCat] = useState<string>('')

  // three independent list states with pagination metadata
  const [documentsState, setDocumentsState] = useState({
    items: [] as any[],
    page: 1,
    page_size: 10,
    total: 0
  })
  const [manualState, setManualState] = useState({
    items: [] as any[],
    page: 1,
    page_size: 10,
    total: 0
  })
  const [aggregatorState, setAggregatorState] = useState({
    items: [] as any[],
    page: 1,
    page_size: 10,
    total: 0
  })

  const theme = useTheme()
  const isSmDown = useMediaQuery(theme.breakpoints.down('sm'))

  // Determine if there is subcategory data
  const hasChildData =
    Array.isArray(childCategories?.expense_sub_categories) &&
    childCategories.expense_sub_categories.length > 0

  // Handle auto-expand if expanded prop is provided
  useEffect(() => {
    if (typeof expanded === 'boolean') {
      setOpen(expanded)
    } else if (hasChildData) {
      setOpen(false) // default closed if no prop
    }
  }, [expanded, hasChildData])

  // helper to safely read totals from API response
  const extractListResponse = (resp: any) => {
    const results = resp?.data?.data?.results ?? resp?.data?.results ?? []
    const total = resp?.data?.data?.count
    return { results, total }
  }

  // fetch functions for each endpoint
  const fetchDocuments = async (page = 1, page_size = 10, subCat?: string) => {
    try {
      const response = await apiClient.get(
        endpoints.documents.expenseBreakdownDocuments(activePracticeId ?? ''),
        {
          params: {
            start_date: toApiDate(dateRange?.start),
            end_date: toApiDate(dateRange?.end),
            sub_cat: subCat ?? currentSubCat,
            cat: 'Expense',
            page,
            page_size
          }
        }
      )
      const { results, total } = extractListResponse(response)
      setDocumentsState({ items: results, page, page_size, total })
    } catch {
      setDocumentsState({ items: [], page, page_size, total: 0 })
    }
  }

  const fetchManual = async (page = 1, page_size = 10, subCat?: string) => {
    try {
      const response = await apiClient.get(
        endpoints.documents.expenseBreakdownManualDocuments(
          activePracticeId ?? ''
        ),
        {
          params: {
            start_date: toApiDate(dateRange?.start),
            end_date: toApiDate(dateRange?.end),
            sub_cat: subCat ?? currentSubCat,
            cat: 'Expense',
            page,
            page_size
          }
        }
      )
      const { results, total } = extractListResponse(response)
      setManualState({ items: results, page, page_size, total })
    } catch {
      setManualState({ items: [], page, page_size, total: 0 })
    }
  }

  const fetchAggregator = async (page = 1, page_size = 10, subCat?: string) => {
    console.warn(page)
    console.warn(page_size)
    console.warn(subCat)

    try {
      const response = await apiClient.get(
        endpoints.documents.expenseBreakdownAggregatorDocuments(
          activePracticeId ?? ''
        ),
        {
          params: {
            start_date: toApiDate(dateRange?.start),
            end_date: toApiDate(dateRange?.end),
            sub_cat: subCat ?? currentSubCat,
            cat: 'Expense',
            page,
            page_size
          }
        }
      )
      const { results, total } = extractListResponse(response)
      setAggregatorState({ items: results, page, page_size, total })
    } catch {
      setAggregatorState({ items: [], page, page_size, total: 0 })
    }
  }

  const handleDocumentDetails = async (type: string) => {
    // open modal and load first page for all three lists (default page_size: 10)
    setCurrentSubCat(type)
    setOpenDocumentDetails(true)

    // reset UI quickly (optional)
    setDocumentsState((s) => ({ ...s, items: [], page: 1, page_size: 10 }))
    setManualState((s) => ({ ...s, items: [], page: 1, page_size: 10 }))
    setAggregatorState((s) => ({ ...s, items: [], page: 1, page_size: 10 }))

    // fetch page 1 for all three lists in parallel
    fetchDocuments(1, 10, type)
    fetchManual(1, 10, type)
    fetchAggregator(1, 10, type)
  }

  // callbacks passed to modal for pagination controls
  const onFetchDocumentsPage = (page: number, page_size: number) => {
    fetchDocuments(page, page_size)
  }
  const onFetchManualPage = (page: number, page_size: number) => {
    fetchManual(page, page_size)
  }
  const onFetchAggregatorPage = (page: number, page_size: number) => {
    fetchAggregator(page, page_size)
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
          {hasChildData ? (
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
          ) : (
            <IconButton
              sx={{ width: '34px' }}
              aria-label='expand row'
              disabled={true}
            ></IconButton>
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
            {hasChildData && (
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
      {hasChildData && (
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
                          Line Item
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ width: { xs: '30%', sm: '30%' } }}>
                        <Typography variant='subtitle2' fontWeight={500}>
                          Amount
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ width: { xs: '20%', sm: '40%' } }}>
                        <Typography variant='subtitle2' fontWeight={500}>
                          Source Documents
                        </Typography>
                      </TableCell>
                    </TableRow>

                    {/* CHILD DATA ROWS */}
                    {childCategories.expense_sub_categories.map(
                      (cat: any, idx: number) => {
                        const entry = Object.entries(cat)[0] as
                          | [string, any]
                          | undefined
                        const key = entry ? entry[0] : ''
                        const value = entry ? entry[1] : 0

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
      )}

      <DocumentDetailsModal
        open={openDocumentDetails}
        onClose={() => setOpenDocumentDetails(false)}
        documents={documentsState.items}
        documentsPage={documentsState.page}
        documentsPageSize={documentsState.page_size}
        documentsTotal={documentsState.total}
        manualEntries={manualState.items}
        manualPage={manualState.page}
        manualPageSize={manualState.page_size}
        manualTotal={manualState.total}
        aggregators={aggregatorState.items}
        aggregatorPage={aggregatorState.page}
        aggregatorPageSize={aggregatorState.page_size}
        aggregatorTotal={aggregatorState.total}
        onFetchDocumentsPage={onFetchDocumentsPage}
        onFetchManualPage={onFetchManualPage}
        onFetchAggregatorPage={onFetchAggregatorPage}
      />
    </>
  )
}
