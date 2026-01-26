import { ChevronRight } from '@mui/icons-material'
import { Box, IconButton, Typography, TypographyProps } from '@mui/material'
import React from 'react'

interface FeedbackTypeProps {
  /** Label text */
  label: string

  /** Background color */
  bgColor?: string

  /** Border color */
  borderColor?: string

  /** Left icon (SVG, img, or MUI icon) */
  icon?: React.ReactNode

  /** Typography customization */
  typographyProps?: TypographyProps

  /** Right icon (default: ChevronRight) */
  rightIcon?: React.ReactNode

  /** Click handler */
  onClick?: () => void
}

const FeedbackType: React.FC<FeedbackTypeProps> = ({
  label,
  bgColor = 'rgba(211, 47, 47, 0.04)',
  borderColor = '#D32F2F',
  icon,
  typographyProps,
  rightIcon = <ChevronRight />,
  onClick
}) => {
  return (
    <Box
      padding='10px'
      display='flex'
      justifyContent='space-between'
      gap={1}
      borderRadius='12px'
      border={`1px solid ${borderColor}`}
      bgcolor={bgColor}
      alignItems='center'
      height='40px'
      flex={1}
      onClick={onClick}
      sx={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <Box display='flex' gap={1} alignItems='center'>
        {icon}
        <Typography {...typographyProps}>{label}</Typography>
      </Box>

      <IconButton size='small'>{rightIcon}</IconButton>
    </Box>
  )
}

export default FeedbackType
