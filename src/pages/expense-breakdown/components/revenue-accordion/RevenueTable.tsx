// RevenueBreakdownTable.tsx
import React, { useEffect, useState } from 'react'
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableRow,
  IconButton,
  Collapse,
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

interface RevenueBreakdownTableProps {
  data?: Array<{
    revenue_type?: string
    source?: string
    amount?: string
    revenue_sub_categories?: any[]
  }>
  dateRange?: RangeISO
  total?: string | number
  title?: string
  expanded?: boolean
}

const RevenueBreakdownTable: React.FC<RevenueBreakdownTableProps> = ({
  data = [],
  total,
  title = '',
  dateRange,
  expanded
}) => {
  const rows = data || []

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
                Revenue Type
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

          {/* ROWS */}
          {rows.map((row, idx) => (
            <RevenueExpandableRow
              key={row.revenue_type ?? idx}
              row={row}
              dateRange={dateRange}
              expanded={expanded}
            />
          ))}
        </TableBody>
      </Table>

      {/* TOTAL SECTION */}
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

export default RevenueBreakdownTable

// ----------------------------------------------------------
//                EXPANDABLE ROW FOR REVENUE
// ----------------------------------------------------------
interface RevenueExpandableRowProps {
  row: any
  dateRange?: RangeISO
  expanded?: boolean
}

const RevenueExpandableRow: React.FC<RevenueExpandableRowProps> = ({
  row,
  dateRange,
  expanded
}) => {
  const [open, setOpen] = useState(false)
  const { activePracticeId } = useActivePractice()
  const [openDocumentDetails, setOpenDocumentDetails] = useState<boolean>(false)

  // current subcategory used as param when fetching lists for modal
  const [currentSubCat, setCurrentSubCat] = useState<string>('')

  // three independent states for lists + pagination
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
  const isSm = useMediaQuery(theme.breakpoints.down('sm'))

  // detect child data similar to expense table (if any)
  const hasChildData =
    Array.isArray(row?.revenue_sub_categories) &&
    row.revenue_sub_categories.length > 0

  // keep controlled open from prop if provided
  useEffect(() => {
    if (typeof expanded === 'boolean') {
      setOpen(expanded)
    } else if (hasChildData) {
      setOpen(false)
    }
  }, [expanded, hasChildData])

  // helper to extract results + total defensively
  const extractListResponse = (resp: any) => {
    const results = resp?.data?.data?.results ?? resp?.data?.results ?? []
    const total =
      resp?.data?.data?.count ??
      resp?.data?.data?.total ??
      resp?.data?.count ??
      resp?.data?.total ??
      0
    return { results, total }
  }

  // fetchers — same endpoints as expense but with cat='Revenue'
  const fetchDocuments = async (page = 1, page_size = 10, subCat?: string) => {
    try {
      const response = await apiClient.get(
        endpoints.documents.expenseBreakdownDocuments(activePracticeId ?? ''),
        {
          params: {
            start_date: toApiDate(dateRange?.start ?? null),
            end_date: toApiDate(dateRange?.end ?? null),
            sub_cat: subCat ?? currentSubCat,
            cat: 'Revenue',
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
            start_date: toApiDate(dateRange?.start ?? null),
            end_date: toApiDate(dateRange?.end ?? null),
            sub_cat: subCat ?? currentSubCat,
            cat: 'Revenue',
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
    // try {
    //   const response = await apiClient.get(
    //     endpoints.documents.expenseBreakdownAggregatorDocuments(
    //       activePracticeId ?? ''
    //     ),
    //     {
    //       params: {
    //         start_date: toApiDate(dateRange?.start ?? null),
    //         end_date: toApiDate(dateRange?.end ?? null),
    //         sub_cat: subCat ?? currentSubCat,
    //         cat: 'Revenue',
    //         page,
    //         page_size
    //       }
    //     }
    //   )
    //   const { results, total } = extractListResponse(response)
    //   setAggregatorState({ items: results, page, page_size, total })
    // } catch {
    //   setAggregatorState({ items: [], page, page_size, total: 0 })
    // }
  }

  const handleDocumentDetails = (subCat: string) => {
    // open and load page 1 for all three lists (page_size default 10)
    setCurrentSubCat(subCat)
    setOpenDocumentDetails(true)

    // reset UI quickly
    setDocumentsState((s) => ({ ...s, items: [], page: 1, page_size: 10 }))
    setManualState((s) => ({ ...s, items: [], page: 1, page_size: 10 }))
    setAggregatorState((s) => ({ ...s, items: [], page: 1, page_size: 10 }))

    // fetch in parallel
    fetchDocuments(1, 10, subCat)
    fetchManual(1, 10, subCat)
    fetchAggregator(1, 10, subCat)
  }

  // callbacks passed to modal to request pages
  const onFetchDocumentsPage = (page: number, page_size: number) =>
    fetchDocuments(page, page_size)
  const onFetchManualPage = (page: number, page_size: number) =>
    fetchManual(page, page_size)
  const onFetchAggregatorPage = (page: number, page_size: number) =>
    fetchAggregator(page, page_size)

  return (
    <>
      {/* parent row */}
      <TableRow
        sx={{
          background: '#FFF',
          display: 'table-row',
          marginBottom: open ? '0px' : '6px',
          '& > td': {
            padding: isSm ? '8px 10px' : '12px 16px',
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
        {/* expand control */}
        <TableCell
          sx={{ width: isSm ? '36px' : '40px', padding: '0px !important' }}
        >
          {hasChildData ? (
            <IconButton
              aria-label='expand row'
              size={isSm ? 'small' : 'small'}
              onClick={() => setOpen(!open)}
              sx={{ padding: isSm ? '4px' : undefined }}
            >
              {open ? <ArrowDropUp /> : <ArrowDropDown />}
            </IconButton>
          ) : (
            <IconButton
              sx={{ width: '34px' }}
              aria-label='expand row'
              disabled
            />
          )}
        </TableCell>

        {/* revenue type */}
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
              sx={{ fontSize: isSm ? '13px' : '14px' }}
            >
              {row?.revenue_type ?? '-'}
            </Typography>
            {hasChildData && (
              <Chip
                label={`${row?.revenue_sub_categories?.length ?? 0} subcategories`}
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

        {/* amount */}
        <TableCell sx={{ width: { xs: '30%', sm: '30%' } }} align='left'>
          <Typography
            variant='subtitle2'
            fontWeight={500}
            sx={{ fontSize: isSm ? '13px' : '14px' }}
          >
            £{formatAmountWithCommas(row?.amount ?? '0.00')}
          </Typography>
        </TableCell>

        {/* documents button */}
        <TableCell sx={{ width: { xs: '20%', sm: '40%' } }} align='left'>
          <IconButton
            size={isSm ? 'small' : 'small'}
            aria-label='View Revenue details'
            onClick={() => handleDocumentDetails(row?.revenue_type ?? '')}
            sx={{ padding: isSm ? '6px' : undefined }}
          >
            <RemoveRedEyeOutlinedIcon fontSize='small' />
          </IconButton>
        </TableCell>
      </TableRow>

      {/* optional child rows (if revenue_sub_categories exist) */}
      {hasChildData && (
        <TableRow>
          <TableCell colSpan={4} sx={{ padding: 0, border: 'none' }}>
            <Collapse in={open} timeout='auto' unmountOnExit>
              <Box
                sx={{
                  background: '#FFFFFF',
                  marginTop: '-6px',
                  padding: isSm ? '8px 8px' : '10px',
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
                    {/* child header */}
                    <TableRow
                      sx={{
                        background: '#F0F0F0',
                        borderRadius: '12px',
                        '& > td': {
                          padding: isSm ? '6px 10px' : '7px 16px',
                          border: 'none',
                          fontWeight: 600,
                          fontSize: isSm ? '13px' : '14px',
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
                      <TableCell sx={{ width: isSm ? '36px' : '40px' }} />
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

                    {/* map child items */}
                    {row.revenue_sub_categories?.map(
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
                                padding: isSm ? '8px 10px' : '12px 16px',
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
                                width: isSm ? '36px' : '40px',
                                padding: '0px !important'
                              }}
                            >
                              <IconButton
                                size='small'
                                disabled
                                sx={{ padding: isSm ? '4px' : undefined }}
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
                                size={isSm ? 'small' : 'small'}
                                aria-label='View Revenue details'
                                onClick={() => handleDocumentDetails(key)}
                                sx={{ padding: isSm ? '6px' : undefined }}
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

      {/* modal showing three lists (documents/manual/aggregator) with pagination */}
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
