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

interface ExpenseBreakdownTableProps {
  data?: any
}

const columnWidths = {
  col1: '40px',
  col2: '30%',
  col3: '30%',
  col4: '40%'
}

const ExpenseBreakdownTable = ({ data }: ExpenseBreakdownTableProps) => {
  const expenseTypes = data?.current?.expense_types || []
  const categories = data?.current?.categories || []

  const getChildCategories = (parentName: string) =>
    categories.filter(
      (cat: any) =>
        cat.parent_category?.toLowerCase() === parentName.toLowerCase()
    )

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
          {expenseTypes.map((type: any) => {
            const children = getChildCategories(type.expense_type)
            return (
              <ExpandableRow
                key={type.expense_type}
                row={type}
                childCategories={children}
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
          £18,000
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
}

const ExpandableRow = ({ row, childCategories }: ExpandableRowProps) => {
  const [open, setOpen] = useState(false)
  const [openDocumentDetails, setOpenDocumentDetails] = useState<boolean>(false)

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
          {childCategories.length > 0 && (
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
              {row.expense_type}
            </Typography>
            {childCategories.length > 0 && (
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
            {parseFloat(row.share_of_total_percent).toFixed(2)}%
          </Typography>
        </TableCell>

        {/* col 4 */}
        <TableCell sx={{ width: columnWidths.col4 }} align='left'>
          <IconButton
            size='small'
            aria-label='View Expense details'
            onClick={() => setOpenDocumentDetails(true)}
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
                  {childCategories.map((cat: any, idx: number) => (
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
                        {cat.expense_category}
                      </TableCell>
                      <TableCell
                        sx={{ width: columnWidths.col3, fontWeight: 500 }}
                      >
                        {parseFloat(cat.share_of_total_percent).toFixed(2)}%
                      </TableCell>
                      <TableCell sx={{ width: columnWidths.col4 }}>
                        <IconButton
                          size='small'
                          aria-label='View Expense details'
                          onClick={() => setOpenDocumentDetails(true)}
                        >
                          <RemoveRedEyeOutlinedIcon fontSize='small' />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
      <DocumentDetailsModal
        open={openDocumentDetails}
        onClose={() => setOpenDocumentDetails(false)}
      />
    </>
  )
}
