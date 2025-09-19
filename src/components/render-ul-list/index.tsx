// File: src/components/InfoList.tsx
import { Box, Typography } from '@mui/material'

type InfoListProps = {
  items: string[]
}

export default function RenderUlList({ items }: InfoListProps) {
  return (
    <Box component='ul' sx={{ pl: 3, m: 0 }} lineHeight={'175%'}>
      {items.map((item, index) => (
        <li key={index}>
          <Typography variant='subtitle1'>{item}</Typography>
        </li>
      ))}
    </Box>
  )
}
