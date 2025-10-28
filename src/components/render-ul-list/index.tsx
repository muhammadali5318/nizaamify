import { Box, Typography, TypographyProps } from '@mui/material'

type InfoListProps = {
  items: string[]
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
          <Typography variant={variant} fontWeight={fontWeight}>
            {item}
          </Typography>
        </li>
      ))}
    </Box>
  )
}
