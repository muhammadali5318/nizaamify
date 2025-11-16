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
import { debounce } from 'lodash'
import DateRangeSelector, { RangeISO } from 'src/components/date-range-selector'
import {
  DOCUMENT_SUBTYPE_MAP,
  CATEGORY_OPTIONS,
  DOCUMENT_TYPE_OPTIONS
} from '../../config/documentsConfig'
import CloseIcon from '@mui/icons-material/Close'
export interface FilterState {
  searchKey: string
  categories: string[]
  uploadedBy: string[]
  dateRange: RangeISO
  docType?: string | null
  docSubtype?: string[]
}

const FilterBar: React.FC<{
  value: FilterState
  onChange: (next: Partial<FilterState>) => void
  uploadedByOptions?: string[]
  isUploadedByLoading?: boolean
  onClearFilters?: () => void // Prop to handle clear filters
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
    docSubtype = []
  } = value

  // Local controlled input for search (debounced to parent)
  const [localSearch, setLocalSearch] = useState<string>(searchKey)

  // subtype options depend on docType
  const subtypeOptions = docType ? (DOCUMENT_SUBTYPE_MAP[docType] ?? []) : []

  // debounced function to update parent searchKey
  const debouncedUpdateSearch = useMemo(
    () =>
      debounce((val: string) => {
        onChange({ searchKey: val })
      }, 800),
    [onChange]
  )

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      debouncedUpdateSearch.cancel()
    }
  }, [debouncedUpdateSearch])

  // Keep localSearch in sync with parent value and cancel pending debounced calls
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

  // Immediate clear of search (cancels debounce and notifies parent immediately)
  const clearSearch = useCallback(() => {
    debouncedUpdateSearch.cancel()
    setLocalSearch('')
    onChange({ searchKey: '' })
  }, [debouncedUpdateSearch, onChange])

  // Handle clear filters logic
  const handleClearFilters = () => {
    if (onClearFilters) {
      onClearFilters()
    }
  }

  return (
    <Box
      className={styles.filterContainer}
      display='flex'
      gap={2}
      flexWrap='wrap'
      alignItems='center'
    >
      <TextField
        label='Search'
        variant='outlined'
        value={localSearch}
        onChange={handleSearchChange}
        placeholder='Search by name'
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position='end'>
                {localSearch ? (
                  <IconButton
                    aria-label='clear search'
                    size='small'
                    onClick={clearSearch}
                  >
                    <ClearIcon fontSize='small' />
                  </IconButton>
                ) : null}
              </InputAdornment>
            )
          }
        }}
        sx={{ minWidth: 220 }}
      />

      <FormControl>
        <InputLabel id='categories-select-label'>Categories</InputLabel>
        <Select
          labelId='categories-select-label'
          multiple
          value={categories}
          onChange={(e) => {
            const v = e.target.value
            onChange({ categories: typeof v === 'string' ? v.split(',') : v })
          }}
          renderValue={(selected) =>
            (selected as string[])
              .map(
                (val) =>
                  CATEGORY_OPTIONS.find((o) => o.value === val)?.label ?? val
              )
              .join(', ')
          }
          label='Categories'
          MenuProps={{}}
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              <Checkbox checked={categories.indexOf(opt.value) > -1} />
              <ListItemText primary={opt.label} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl>
        <InputLabel id='uploaded-by-select-label'>Uploaded By</InputLabel>
        <Select
          labelId='uploaded-by-select-label'
          multiple
          value={uploadedBy}
          onChange={(e) => {
            const v = e.target.value
            onChange({ uploadedBy: typeof v === 'string' ? v.split(',') : v })
          }}
          renderValue={(selected) => (selected as string[]).join(', ')}
          label='Uploaded By'
          MenuProps={{}}
          disabled={isUploadedByLoading}
        >
          {isUploadedByLoading ? (
            <MenuItem disabled>
              <em>Loading…</em>
            </MenuItem>
          ) : (
            uploadedByOptions.map((name) => (
              <MenuItem key={name} value={name}>
                <Checkbox checked={uploadedBy.indexOf(name) > -1} />
                <ListItemText primary={name} />
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>

      {/* Document Type (single select) */}
      <FormControl>
        <InputLabel id='document-type-select-label'>Document Type</InputLabel>
        <Select
          labelId='document-type-select-label'
          value={docType ?? ''}
          onChange={(e) => {
            const next = e.target.value as string
            // reset subtype when type changes
            onChange({ docType: next || null, docSubtype: [] })
          }}
          label='Document Type'
          MenuProps={{}}
        >
          <MenuItem value=''>
            <em>All</em>
          </MenuItem>
          {DOCUMENT_TYPE_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Document Subtype (multi-select, dependent on Document Type) */}
      <FormControl>
        <InputLabel id='document-subtype-select-label'>
          Document Subtype
        </InputLabel>
        <Select
          labelId='document-subtype-select-label'
          multiple
          value={docSubtype}
          onChange={(e) => {
            const v = e.target.value
            onChange({ docSubtype: typeof v === 'string' ? v.split(',') : v })
          }}
          renderValue={(selected) => (selected as string[]).join(', ')}
          label='Document Subtype'
          MenuProps={{}}
          disabled={!docType}
        >
          {!docType ? (
            <MenuItem disabled>
              <em>Select Document Type first</em>
            </MenuItem>
          ) : (
            subtypeOptions.map((st) => (
              <MenuItem key={st} value={st}>
                <Checkbox checked={(docSubtype || []).indexOf(st) > -1} />
                <ListItemText primary={st} />
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>

      {/* Date Range */}
      <DateRangeSelector
        value={dateRange}
        onChange={(next) => onChange({ dateRange: next })}
      />

      {/* Clear Filters Button */}
      <Box>
        <Button
          startIcon={<CloseIcon />}
          variant='text'
          color='primary'
          onClick={handleClearFilters}
          sx={{ minWidth: 120 }}
        >
          Clear Filters
        </Button>
      </Box>
    </Box>
  )
}

export default FilterBar
