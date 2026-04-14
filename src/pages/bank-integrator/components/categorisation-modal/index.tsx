import React, { useEffect, useMemo, useRef, useState } from 'react'
import dayjs, { Dayjs } from 'dayjs'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  SelectChangeEvent
} from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'

import {
  getFilteredDocumentTypes,
  getDocumentSubtypes,
  getExpenseSubcategories,
  category as categoryConstants
} from 'src/utils/documentMapping'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'

type CategorisationModalProps = {
  open: boolean
  onClose: () => void
  onSave?: (
    payload: {
      category: string
      type: string
      subtype: string
      lineItem: string
      transaction_posting_date: string
    },
    row: any
  ) => void
  initial?: {
    category?: string
    type?: string
    subtype?: string
    lineItem?: string
    transaction_posting_date?: string
  }
  row?: any
}

const CategorisationModal: React.FC<CategorisationModalProps> = ({
  open,
  onClose,
  onSave,
  initial,
  row
}) => {
  const [category, setCategory] = useState<string>(categoryConstants.expense)
  const [type, setType] = useState<string>('')
  const [subtype, setSubtype] = useState<string>('')
  const [lineItem, setLineItem] = useState<string>('')
  const [transactionDate, setTransactionDate] = useState<Dayjs | null>(null)

  const isInitializingRef = useRef(false)

  useEffect(() => {
    if (!open) return

    isInitializingRef.current = true

    setCategory(initial?.category ?? categoryConstants.expense)
    setType(initial?.type ?? '')
    setSubtype(initial?.subtype ?? '')
    setLineItem(initial?.lineItem ?? '')
    setTransactionDate(
      initial?.transaction_posting_date
        ? dayjs(initial.transaction_posting_date)
        : null
    )

    setTimeout(() => {
      isInitializingRef.current = false
    }, 0)
  }, [open, initial])

  const types = useMemo(() => getFilteredDocumentTypes(category), [category])

  const subtypes = useMemo(() => getDocumentSubtypes(type), [type])

  const lineItems = useMemo(() => {
    if (!type || !subtype) return []
    return getExpenseSubcategories(type, subtype)
  }, [type, subtype])

  useEffect(() => {
    if (isInitializingRef.current) return
    setType('')
    setSubtype('')
    setLineItem('')
  }, [category])

  useEffect(() => {
    if (isInitializingRef.current) return
    setSubtype('')
    setLineItem('')
  }, [type])

  useEffect(() => {
    if (isInitializingRef.current) return
    setLineItem('')
  }, [subtype])

  const isValid =
    Boolean(category) &&
    Boolean(type) &&
    Boolean(transactionDate) &&
    (type === 'Income & Revenue' || (Boolean(subtype) && Boolean(lineItem)))

  const handleSave = () => {
    if (!isValid || !transactionDate) return

    onSave?.(
      {
        category,
        type,
        subtype,
        lineItem,
        transaction_posting_date: transactionDate.format('YYYY-MM-DD')
      },
      row
    )

    onClose()
  }

  const menuProps = { disablePortal: true }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth='sm'
      slotProps={{
        paper: {
          sx: {
            py: '36px',
            px: { xs: 2, sm: 6 },
            borderRadius: '24px'
          }
        }
      }}
    >
      <DialogTitle sx={{ p: 0 }}>
        <Typography variant='h5' fontWeight={700}>
          Categorise
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ p: 0, mt: 2 }}>
        <Stack spacing={2} mt={2}>
          <FormControl fullWidth>
            <InputLabel>Type *</InputLabel>
            <Select
              disabled
              value={category}
              label='Type *'
              MenuProps={menuProps}
              onChange={(e: SelectChangeEvent<string>) =>
                setCategory(e.target.value)
              }
            >
              <MenuItem value={categoryConstants.expense}>
                {categoryConstants.expense}
              </MenuItem>
              <MenuItem value={categoryConstants.revenue}>
                {categoryConstants.revenue}
              </MenuItem>
              <MenuItem value={categoryConstants.unknown}>
                {categoryConstants.unknown}
              </MenuItem>
            </Select>
          </FormControl>

          {/* TYPE */}
          <FormControl fullWidth disabled={!category}>
            <InputLabel>Category *</InputLabel>
            <Select
              value={type}
              label='Category *'
              MenuProps={menuProps}
              onChange={(e) => setType(e.target.value)}
            >
              {types.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* SUBTYPE */}
          <FormControl
            fullWidth
            disabled={!type || type === 'Income & Revenue'}
          >
            <InputLabel>Subcategory *</InputLabel>
            <Select
              value={subtype}
              label='Subcategory *'
              MenuProps={menuProps}
              onChange={(e) => setSubtype(e.target.value)}
            >
              {subtypes.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* LINE ITEM */}
          <FormControl
            fullWidth
            disabled={!subtype || type === 'Income & Revenue'}
          >
            <InputLabel>Line Item *</InputLabel>
            <Select
              value={lineItem}
              label='Line Item *'
              MenuProps={menuProps}
              onChange={(e) => setLineItem(e.target.value)}
            >
              {lineItems.length > 0 ? (
                lineItems.map((li) => (
                  <MenuItem key={li} value={li}>
                    {li}
                  </MenuItem>
                ))
              ) : (
                <MenuItem value=''>
                  <em>No line items</em>
                </MenuItem>
              )}
            </Select>
          </FormControl>

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              label='Transaction posting date'
              value={transactionDate}
              onChange={(newValue) => setTransactionDate(newValue)}
              format='YYYY-MM-DD'
              disableFuture
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true,
                  sx: {
                    '& .MuiPickersInputBase-root': { borderRadius: '12px' }
                  }
                }
              }}
            />
          </LocalizationProvider>
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          p: 0,
          mt: 2.5,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2
        }}
      >
        <Button
          onClick={onClose}
          variant='outlined'
          size='large'
          fullWidth
          sx={{ flex: 1 }}
        >
          Cancel
        </Button>

        <Button
          sx={{ flex: 1 }}
          variant='contained'
          size='large'
          fullWidth
          onClick={handleSave}
          disabled={!isValid}
        >
          Mark & Continue
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default CategorisationModal
