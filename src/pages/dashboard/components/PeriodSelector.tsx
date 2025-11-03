// src/components/PeriodSelector.tsx
import { Box, Typography } from '@mui/material'
import React from 'react'

interface PeriodSelectorProps {
  options: string[]
  selected: string
  onSelect: (option: string) => void
}

const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  options,
  selected,
  onSelect
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        border: '1px solid #E0E0E0',
        borderRadius: '12px',
        padding: '3px',
        backgroundColor: '#fff',
        width: 'fit-content',
        height: 46
      }}
    >
      {options.map((option) => {
        const isActive = selected === option
        return (
          <Box
            key={option}
            onClick={() => onSelect(option)}
            sx={{
              cursor: 'pointer',
              px: 2.5,
              py: 0.8,
              borderRadius: '12px',
              height: 36,
              backgroundColor: isActive ? '#000' : 'transparent',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                backgroundColor: isActive ? '#000' : '#f5f5f5'
              }
            }}
          >
            <Typography
              variant='body2'
              sx={{
                fontSize: '14px',
                fontWeight: 500,
                color: isActive ? '#fff' : '#000'
              }}
            >
              {option}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}

export default PeriodSelector
