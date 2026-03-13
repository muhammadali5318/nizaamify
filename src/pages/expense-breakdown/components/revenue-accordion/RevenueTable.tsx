import React, { useState } from 'react'
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
  useTheme,
  useMediaQuery,
  IconButton
} from '@mui/material'
import { formatAmountWithCommas } from 'src/utils/stringUtils'
import RemoveRedEyeOutlinedIcon from '@mui/icons-material/RemoveRedEyeOutlined'
import DocumentDetailsModal from '../document-details-modal'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { toApiDate } from '../../hooks/useFetchExpenseBreakdown'
import { useActivePractice } from 'src/hooks/useActivePractice'

interface RevenueBreakdownTableProps {
  data?: Array<{ revenue_type?: string; source?: string; amount?: string }>
  dateRange?: any // kept for compatibility (you can remove if unused)
  total?: string | number
  title?: string
}

const RevenueBreakdownTable: React.FC<RevenueBreakdownTableProps> = ({
  data = [],
  total,
  title = '',
  dateRange
}) => {
  const theme = useTheme()
  const isSmDown = useMediaQuery(theme.breakpoints.down('sm'))
  const { activePracticeId } = useActivePractice()

  const [openDocumentDetails, setOpenDocumentDetails] = useState<boolean>(false)
  const [downloadableDocuments, setDownloadableDocuments] =
    useState<any>(undefined)

  // If total prop isn't provided, compute from data

  const handleDocumentDetails = async (subCat: string, source: string) => {
    try {
      const response = await apiClient.get(
        endpoints.documents.expenseBreakdownDocuments(activePracticeId ?? ''),
        {
          params: {
            start_date: toApiDate(dateRange?.start),
            end_date: toApiDate(dateRange?.end),
            cat: 'Revenue',
            sub_cat: subCat,
            module: source === 'mannual' ? 'manual_entries' : 'docs'
          }
        }
      )
      setDownloadableDocuments(response?.data?.data)
      setOpenDocumentDetails(true)
    } catch {
      setDownloadableDocuments(undefined)
      setOpenDocumentDetails(true)
    }
  }

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

          {/* SIMPLE ROWS (no collapsible behavior) */}
          {data.map((row, idx) => (
            <TableRow
              key={row.revenue_type ?? idx}
              sx={{
                background: '#FFF',
                display: 'table-row',
                marginBottom: '6px',
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
              <TableCell
                sx={{
                  width: isSmDown ? '36px' : '40px',
                  padding: '0px !important'
                }}
              >
                <IconButton
                  sx={{ width: '34px' }}
                  aria-label='expand row'
                  disabled={true}
                ></IconButton>
              </TableCell>

              {/* Subcategory / revenue_type */}
              <TableCell
                sx={{ width: { xs: '50%', sm: '30%' } }}
                component='th'
              >
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
                    {row.revenue_type ?? '-'}
                  </Typography>
                </Box>
              </TableCell>

              {/* Amount */}
              <TableCell sx={{ width: { xs: '30%', sm: '30%' } }} align='left'>
                <Typography
                  variant='subtitle2'
                  fontWeight={500}
                  sx={{ fontSize: isSmDown ? '13px' : '14px' }}
                >
                  £{formatAmountWithCommas(row.amount ?? '0.00')}
                </Typography>
              </TableCell>

              {/* Source Documents (show source as simple chip/text) */}
              <TableCell sx={{ width: { xs: '20%', sm: '40%' } }} align='left'>
                <IconButton
                  size={isSmDown ? 'small' : 'small'}
                  aria-label='View Expense details'
                  onClick={() =>
                    handleDocumentDetails(
                      row?.revenue_type ?? '',
                      row?.source ?? ''
                    )
                  }
                  sx={{ padding: isSmDown ? '6px' : undefined }}
                >
                  <RemoveRedEyeOutlinedIcon fontSize='small' />
                </IconButton>
              </TableCell>
            </TableRow>
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

      <DocumentDetailsModal
        open={openDocumentDetails}
        onClose={() => setOpenDocumentDetails(false)}
        downloadableDocuments={downloadableDocuments}
      />
    </Box>
  )
}

export default RevenueBreakdownTable
