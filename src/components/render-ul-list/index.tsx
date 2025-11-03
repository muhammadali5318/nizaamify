import React from 'react'
import { Box, Typography, TypographyProps } from '@mui/material'

type InfoListProps = {
  items: Array<string | React.ReactNode>
  variant?: TypographyProps['variant']
  fontWeight?: number
}

export default function RenderUlList({
  items,
  variant = 'subtitle1',
  fontWeight = 500
}: InfoListProps) {
  return (
    <Box component='ul' sx={{ pl: 3, m: 0 }} lineHeight='175%'>
      {items.map((item, index) => (
        <li key={index}>
          {typeof item === 'string' ? (
            <Typography variant={variant} fontWeight={fontWeight}>
              {item}
            </Typography>
          ) : React.isValidElement(item) ? (
            // If caller passed a React node (e.g. <strong> or <Typography>), render it directly.
            item
          ) : (
            // For anything else (e.g. fragments), wrap in Typography to keep visual consistency.
            <Typography variant={variant} fontWeight={fontWeight}>
              {item}
            </Typography>
          )}
        </li>
      ))}
    </Box>
  )
}
