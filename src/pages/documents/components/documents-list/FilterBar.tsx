// src/components/documents-list/FilterBar.tsx
import styles from './FilterBar.module.scss'
import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  InputAdornment,
  IconButton,
  Button
} from '@mui/material'
import ClearIcon from '@mui/icons-material/Clear'
import CloseIcon from '@mui/icons-material/Close'
import { debounce } from 'lodash'
import DateRangeSelector, { RangeISO } from 'src/components/date-range-selector'

import {
  CATEGORY_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
  CATEGORY_TYPE_MAP,
  getDocumentSubtypes,
  getExpenseSubcategories
} from '../../config/documentsConfig'

export interface FilterState {
  searchKey: string
  categories: string[]
  uploadedBy: string[]
  dateRange: RangeISO
  docType?: string | null
  docSubtype?: string[]
  lineItems?: string[]
}

/* -------------------------------------------------------------------------- */
/*                               COMPONENT                                    */
/* -------------------------------------------------------------------------- */

const FilterBar: React.FC<{
  value: FilterState
  onChange: (next: Partial<FilterState>) => void
  uploadedByOptions?: string[]
  isUploadedByLoading?: boolean
  onClearFilters?: () => void
}> = ({
  value,
  onChange,
  uploadedByOptions = [],
  isUploadedByLoading = false,
  onClearFilters
}) => {
  const {
    searchKey = '',
    categories = [],
    uploadedBy = [],
    dateRange,
    docType = null,
    docSubtype = [],
    lineItems = []
  } = value

  /* ------------------------------ SEARCH ---------------------------------- */

  const [localSearch, setLocalSearch] = useState<string>(searchKey)

  const debouncedUpdateSearch = useMemo(
    () =>
      debounce((val: string) => {
        onChange({ searchKey: val })
      }, 800),
    [onChange]
  )

  useEffect(() => () => debouncedUpdateSearch.cancel(), [debouncedUpdateSearch])

  useEffect(() => {
    setLocalSearch(searchKey ?? '')
    debouncedUpdateSearch.cancel()
  }, [searchKey, debouncedUpdateSearch])

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setLocalSearch(val)
      debouncedUpdateSearch(val)
    },
    [debouncedUpdateSearch]
  )

  const clearSearch = () => {
    debouncedUpdateSearch.cancel()
    setLocalSearch('')
    onChange({ searchKey: '' })
  }

  /* -------------------------- DOCUMENT CASCADE ----------------------------- */

  const subtypeOptions = useMemo(
    () => (docType ? getDocumentSubtypes(docType) : []),
    [docType]
  )

  const lineItemOptions = useMemo(() => {
    if (!docType || docSubtype.length === 0) return []

    return Array.from(
      new Set(docSubtype.flatMap((st) => getExpenseSubcategories(docType, st)))
    )
  }, [docType, docSubtype])

  /* -------------------------- CATEGORY FILTERING --------------------------- */

  const allowedDocTypes = useMemo(() => {
    if (categories.length === 0) return DOCUMENT_TYPE_OPTIONS

    const allowedSets = categories.map((c) => CATEGORY_TYPE_MAP[c] || [])
    const merged = new Set(allowedSets.flat())

    return DOCUMENT_TYPE_OPTIONS.filter((opt) => merged.has(opt.value))
  }, [categories])

  /* ------------------------------------------------------------------------ */
  const shouldShowLineItems = docType && docType !== 'Income & Revenue'

  return (
    <Box
      className={styles.filterContainer}
      display='flex'
      gap={2}
      flexWrap='wrap'
      alignItems='center'
    >
      {/* ---------------------------- SEARCH -------------------------------- */}
      <TextField
        label='Search'
        value={localSearch}
        onChange={handleSearchChange}
        placeholder='Search by name'
        sx={{ minWidth: 220 }}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position='end'>
                {localSearch && (
                  <IconButton size='small' onClick={clearSearch}>
                    <ClearIcon fontSize='small' />
                  </IconButton>
                )}
              </InputAdornment>
            )
          }
        }}
      />

      {/* --------------------------- CATEGORY -------------------------------- */}
      <FormControl>
        <InputLabel>Categories</InputLabel>
        <Select
          multiple
          label='Categories'
          value={categories}
          onChange={(e) =>
            onChange({
              categories:
                typeof e.target.value === 'string'
                  ? e.target.value.split(',')
                  : e.target.value
            })
          }
          renderValue={(selected) =>
            (selected as string[])
              .map(
                (val) =>
                  CATEGORY_OPTIONS.find((o) => o.value === val)?.label ?? val
              )
              .join(', ')
          }
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              <Checkbox checked={categories.includes(opt.value)} />
              <ListItemText primary={opt.label} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* ------------------------- UPLOADED BY ------------------------------- */}
      <FormControl>
        <InputLabel>Uploaded By</InputLabel>
        <Select
          label='Uploaded By'
          multiple
          value={uploadedBy}
          disabled={isUploadedByLoading}
          onChange={(e) =>
            onChange({
              uploadedBy:
                typeof e.target.value === 'string'
                  ? e.target.value.split(',')
                  : e.target.value
            })
          }
          renderValue={(selected) => (selected as string[]).join(', ')}
        >
          {uploadedByOptions.map((name) => (
            <MenuItem key={name} value={name}>
              <Checkbox checked={uploadedBy.includes(name)} />
              <ListItemText primary={name} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* ------------------------- DOCUMENT TYPE ----------------------------- */}
      <FormControl>
        <InputLabel>Document Type</InputLabel>
        <Select
          label='Document Type'
          value={docType ?? ''}
          onChange={(e) =>
            onChange({
              docType: e.target.value || null,
              docSubtype: [],
              lineItems: []
            })
          }
        >
          <MenuItem value=''>
            <em>All</em>
          </MenuItem>
          {allowedDocTypes.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* ----------------------- DOCUMENT SUBTYPE ---------------------------- */}
      <FormControl>
        <InputLabel>Document Subtype</InputLabel>
        <Select
          label='Document Subtype'
          multiple
          value={docSubtype}
          disabled={!docType}
          onChange={(e) =>
            onChange({
              docSubtype:
                typeof e.target.value === 'string'
                  ? e.target.value.split(',')
                  : e.target.value,
              lineItems: []
            })
          }
          renderValue={(selected) => (selected as string[]).join(', ')}
        >
          {subtypeOptions.map((st) => (
            <MenuItem key={st} value={st}>
              <Checkbox checked={docSubtype.includes(st)} />
              <ListItemText primary={st} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* --------------------------- LINE ITEMS ------------------------------ */}
      {shouldShowLineItems && (
        <FormControl>
          <InputLabel>Line Item</InputLabel>
          <Select
            label='Line Item'
            multiple
            value={lineItems}
            disabled={lineItemOptions.length === 0}
            onChange={(e) =>
              onChange({
                lineItems:
                  typeof e.target.value === 'string'
                    ? e.target.value.split(',')
                    : e.target.value
              })
            }
            renderValue={(selected) => (selected as string[]).join(', ')}
          >
            {lineItemOptions.map((li) => (
              <MenuItem key={li} value={li}>
                <Checkbox checked={lineItems.includes(li)} />
                <ListItemText primary={li} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {/* -------------------------- DATE RANGE ------------------------------- */}
      <DateRangeSelector
        value={dateRange}
        onChange={(next) => onChange({ dateRange: next })}
      />

      {/* ------------------------- CLEAR FILTERS ----------------------------- */}
      <Button startIcon={<CloseIcon />} variant='text' onClick={onClearFilters}>
        Clear Filters
      </Button>
    </Box>
  )
}

export default FilterBar
