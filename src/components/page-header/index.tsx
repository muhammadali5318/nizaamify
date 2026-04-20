import React from 'react'
import {
  Box,
  Stack,
  Avatar,
  Typography,
  Divider,
  TypographyProps,
  StackProps
} from '@mui/material'

interface PageProps {
  title: string
  description?: React.ReactNode | string
  logo: string
  isDividerVisible?: boolean
  backgroundColor?: string
  containerPadding?: string
  logoWidth?: number
  logoHeight?: number
  descriptionVariant?: TypographyProps['variant']
  headerAlignItems?: StackProps['alignItems']
}

const PageHeader: React.FC<PageProps> = ({
  title,
  description = '',
  logo,
  isDividerVisible = true,
  backgroundColor = '#FFF',
  containerPadding = '0px',
  logoWidth = 45,
  logoHeight = 45,
  descriptionVariant = 'body2',
  headerAlignItems = 'center'
}) => {
  return (
    <Stack
      spacing={2.5}
      width={'100%'}
      sx={{
        backgroundColor,
        padding: containerPadding
      }}
    >
      <Stack direction={'row'} spacing={'10px'} alignItems={headerAlignItems}>
        <Avatar
          src={logo}
          alt={`${title} logo`}
          variant='square'
          sx={{
            width: logoWidth,
            height: logoHeight,
            borderRadius: 3
          }}
        />
        <Box>
          <Typography variant='h6' className='font-weight--700'>
            {title}
          </Typography>

          <Typography variant={descriptionVariant} color='text.secondary'>
            {description}
          </Typography>
        </Box>
      </Stack>

      {isDividerVisible && (
        <Box>
          <Divider sx={{ mb: 2.5 }} />
        </Box>
      )}
    </Stack>
  )
}

export default PageHeader
