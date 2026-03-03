import React, { useEffect, useMemo, useRef, useState } from 'react'
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

import {
  getFilteredDocumentTypes,
  getDocumentSubtypes,
  getExpenseSubcategories,
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
    },
    row: any
  ) => void
  initial?: {
    category?: string
    type?: string
    subtype?: string
    lineItem?: string
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
  /**
   * Local state
   */
  const [category, setCategory] = useState<string>(categoryConstants.expense)
  const [type, setType] = useState<string>('')
  const [subtype, setSubtype] = useState<string>('')
  const [lineItem, setLineItem] = useState<string>('')

  /**
   * Flag to prevent dependent reset during initialization
   */
  const isInitializingRef = useRef(false)

  /**
   * Populate values when modal opens
   */
  useEffect(() => {
    if (!open) return

    isInitializingRef.current = true

    setCategory(initial?.category ?? categoryConstants.expense)
    setType(initial?.type ?? '')
    setSubtype(initial?.subtype ?? '')
    setLineItem(initial?.lineItem ?? '')

    // allow next render cycle to finish before enabling resets
    setTimeout(() => {
      isInitializingRef.current = false
    }, 0)
  }, [open, initial])

  /**
   * Derived dropdown data
   */
  const types = useMemo(() => {
    const filtered = getFilteredDocumentTypes(category)
    return filtered.slice(0, -1)
  }, [category])

  const subtypes = useMemo(() => {
    return getDocumentSubtypes(type)
  }, [type])

  const lineItems = useMemo(() => {
    if (!type || !subtype) return []
    return getExpenseSubcategories(type, subtype)
  }, [type, subtype])

  /**
   * Reset dependent fields ONLY when user changes manually
   */
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

  /**
   * Validation
   */
  const isValid =
    Boolean(category) &&
    Boolean(type) &&
    (type === 'Income & Revenue' || (Boolean(subtype) && Boolean(lineItem)))

  /**
   * Save handler
   */
  const handleSave = () => {
    if (!isValid) return

    onSave?.(
      {
        category,
        type,
        subtype,
        lineItem
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
          {/* CATEGORY */}
          <FormControl fullWidth>
            <InputLabel>Category *</InputLabel>
            <Select
              disabled
              value={category}
              label='Category *'
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
            <InputLabel>Document category *</InputLabel>
            <Select
              value={type}
              label='Document category *'
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
            <InputLabel>Document subcategory *</InputLabel>
            <Select
              value={subtype}
              label='Document subcategory *'
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
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          p: 0,
          mt: 2.5,
          display: 'flex',
          flexDirection: 'row',
          gap: 2
        }}
      >
        <Button
          onClick={onClose}
          variant='outlined'
          size='large'
          sx={{ flex: 1 }}
        >
          Cancel
        </Button>

        <Button
          sx={{ flex: 1 }}
          variant='contained'
          size='large'
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
