import React, { useEffect, useMemo, useState } from 'react'
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
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'

import {
  getFilteredDocumentTypes,
  getDocumentSubtypes,
  getDocumentLineItems,
  getSubtypeForLineItem,
  category as categoryConstants
} from 'src/utils/documentMapping'

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

const getCategoryFromType = (type: string): string => {
  if (type === 'Income & Revenue') return categoryConstants.revenue
  if (type) return categoryConstants.expense
  return categoryConstants.expense
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

  useEffect(() => {
    if (!open) return

    const initialType = initial?.type ?? ''

    const initialCategory = initialType
      ? getCategoryFromType(initialType)
      : (initial?.category ?? categoryConstants.expense)

    const availableTypes = getFilteredDocumentTypes(initialCategory)

    const nextType =
      initialType && availableTypes.includes(initialType) ? initialType : ''

    const nextSubtypes = nextType ? getDocumentSubtypes(nextType) : []

    const nextSubtype =
      initial?.subtype && nextSubtypes.includes(initial.subtype)
        ? initial.subtype
        : ''

    const nextLineItem =
      initial?.lineItem && nextType && nextType !== 'Income & Revenue'
        ? initial.lineItem
        : ''

    setCategory(initialCategory)
    setType(nextType)
    setSubtype(nextSubtype)
    setLineItem(nextLineItem)
    setTransactionDate(
      initial?.transaction_posting_date
        ? dayjs(initial.transaction_posting_date)
        : null
    )
  }, [open, initial])

  const types = useMemo(() => getFilteredDocumentTypes(category), [category])

  const subtypes = useMemo(() => {
    if (!type) return []
    return getDocumentSubtypes(type)
  }, [type])

  const availableLineItems = useMemo(() => {
    if (!type || type === 'Income & Revenue') return []
    return getDocumentLineItems(type, subtype || undefined)
  }, [type, subtype])

  const handleCategoryChange = (value: string) => {
    const nextTypes = getFilteredDocumentTypes(value)
    const autoSelectedType = nextTypes[0] || ''

    setCategory(value)
    setType(autoSelectedType)
    setSubtype('')
    setLineItem('')
  }

  const handleTypeChange = (value: string) => {
    setType(value)
    setCategory(getCategoryFromType(value))
    setSubtype('')
    setLineItem('')
  }

  const handleSubtypeChange = (value: string) => {
    setSubtype(value)
    setLineItem('')
  }

  const handleLineItemChange = (value: string) => {
    const matchedSubtype = getSubtypeForLineItem(type, value)

    setLineItem(value)
    if (matchedSubtype) {
      setSubtype(matchedSubtype)
    }
  }

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
              value={category}
              label='Type *'
              disabled
              MenuProps={menuProps}
              onChange={(e: SelectChangeEvent<string>) =>
                handleCategoryChange(e.target.value)
              }
            >
              <MenuItem value={categoryConstants.expense}>
                {categoryConstants.expense}
              </MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth disabled={!category}>
            <InputLabel>Category *</InputLabel>
            <Select
              value={type}
              label='Category *'
              MenuProps={menuProps}
              onChange={(e: SelectChangeEvent<string>) =>
                handleTypeChange(e.target.value)
              }
            >
              {types.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl
            fullWidth
            disabled={!type || type === 'Income & Revenue'}
          >
            <InputLabel>Subcategory *</InputLabel>
            <Select
              value={subtype}
              label='Subcategory *'
              MenuProps={menuProps}
              onChange={(e: SelectChangeEvent<string>) =>
                handleSubtypeChange(e.target.value)
              }
            >
              {subtypes.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl
            fullWidth
            disabled={!type || type === 'Income & Revenue'}
          >
            <InputLabel>Line Item *</InputLabel>
            <Select
              value={lineItem}
              label='Line Item *'
              MenuProps={menuProps}
              onChange={(e: SelectChangeEvent<string>) =>
                handleLineItemChange(e.target.value)
              }
            >
              {availableLineItems.length > 0 ? (
                availableLineItems.map((li) => (
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
              format='DD-MM-YYYY'
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
