import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { Box, IconButton, Collapse, Typography } from '@mui/material'
import { ArrowDropDown, ArrowDropUp } from '@mui/icons-material'

import { RangeISO } from 'src/components/date-range-selector'
import { formatAmountWithCommas } from 'src/utils/stringUtils'
import RevenueBreakdownTable from './RevenueTable'

interface ReusableAccordionProps {
  title: string
  dateRange: RangeISO
  total?: any
  defaultExpanded?: boolean
  incomeAndRevenue?: any
  expanded?: boolean
}

export default function RevenueAccordion({
  title,
  total = null,
  defaultExpanded = false,
  incomeAndRevenue,
  dateRange,
  expanded
}: ReusableAccordionProps) {
  const [open, setOpen] = useState(defaultExpanded)

  useEffect(() => {
    if (typeof expanded === 'boolean') {
      setOpen(expanded)
    }
  }, [expanded])

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
          </Box>
        </Box>
      </Box>

      {/* Collapsible Content */}
      <Collapse in={open} timeout='auto' unmountOnExit>
        <Box sx={{ px: { xs: 2, sm: 2 }, pb: 2 }}>
          <RevenueBreakdownTable
            data={incomeAndRevenue}
            dateRange={dateRange}
            total={formatAmountWithCommas(total ?? '')}
            title={title}
          />
        </Box>
      </Collapse>
    </Box>
  )
}

RevenueAccordion.propTypes = {
  title: PropTypes.string.isRequired,
  chips: PropTypes.arrayOf(PropTypes.string),
  total: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  defaultExpanded: PropTypes.bool
}
