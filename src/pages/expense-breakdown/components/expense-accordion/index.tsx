import { useState } from 'react'
import PropTypes from 'prop-types'
import {
  Box,
  IconButton,
  Collapse,
  Typography,
  Chip,
  Stack
} from '@mui/material'
import { ArrowDropDown, ArrowDropUp } from '@mui/icons-material'

import ExpenseBreakdownTable from './ExpenseTable'
import { RangeISO } from 'src/components/date-range-selector'
import { formatAmountWithCommas } from 'src/utils/stringUtils'

interface ReusableAccordionProps {
  title: string
  dateRange: RangeISO
  chips?: string[]
  total?: any
  defaultExpanded?: boolean
  expenseSubtypes?: any
}

export default function ReusableAccordion({
  title,
  chips = [],
  total = null,
  defaultExpanded = false,
  expenseSubtypes,
  dateRange
}: ReusableAccordionProps) {
  const [open, setOpen] = useState(defaultExpanded)

  return (
    <Box
      sx={{
        borderRadius: '12px',
        overflow: 'hidden',
        width: '100%',
        background: 'var(--grey-100)',
        // Ensure no horizontal scroll on mobile
        boxSizing: 'border-box'
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          padding: { xs: '12px 16px', sm: '8px 16px' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 0 },
          background: 'var(--grey-100)'
        }}
      >
        {/* Left side: Icon + Title + Chips */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: '12px', sm: '10px' },
            width: { xs: '100%', sm: 'auto' },
            flexWrap: 'wrap'
          }}
        >
          <IconButton
            size='small'
            onClick={() => setOpen((s) => !s)}
            aria-label={open ? 'collapse' : 'expand'}
            sx={{
              m: 0,
              p: { xs: '8px', sm: '0' }, // Larger touch target on mobile
              flexShrink: 0
            }}
          >
            {open ? <ArrowDropUp /> : <ArrowDropDown />}
          </IconButton>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px'
            }}
          >
            <Typography
              variant='subtitle1'
              sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              {title}
            </Typography>

            {/* Chips */}
            {chips.length > 0 && (
              <Stack direction='row' spacing={0.5} flexWrap='wrap'>
                {chips.map((c) => (
                  <Chip
                    key={c}
                    label={c}
                    size='small'
                    sx={{
                      border: '1px solid #BEDBFF',
                      background: '#DBEAFE',
                      color: '#1447E6',
                      fontSize: '0.75rem',
                      height: '24px'
                    }}
                    variant='outlined'
                  />
                ))}
              </Stack>
            )}
          </Box>
        </Box>

        {/* Total Amount - moves below on mobile */}
        {total !== null && (
          <Typography
            variant='h5'
            sx={{
              fontWeight: 700,
              whiteSpace: 'nowrap',
              alignSelf: { xs: 'flex-end', sm: 'center' },
              mt: { xs: 0.5, sm: 0 }
            }}
          >
            £{formatAmountWithCommas(total)}
          </Typography>
        )}
      </Box>

      {/* Collapsible Content */}
      <Collapse in={open} timeout='auto' unmountOnExit>
        <Box sx={{ px: { xs: 2, sm: 2 }, pb: 2 }}>
          <ExpenseBreakdownTable
            data={expenseSubtypes}
            dateRange={dateRange}
            total={formatAmountWithCommas(total ?? '')}
            title={title}
          />
        </Box>
      </Collapse>
    </Box>
  )
}

ReusableAccordion.propTypes = {
  title: PropTypes.string.isRequired,
  chips: PropTypes.arrayOf(PropTypes.string),
  total: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  defaultExpanded: PropTypes.bool
}
