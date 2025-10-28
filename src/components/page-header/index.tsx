import React from 'react'
import { Box, Stack, Avatar, Typography, Divider } from '@mui/material'

interface PageProps {
  title: string
  description: string
  logo: string
  isDividerVisible?: boolean
  backgroundColor?: string
  containerPadding?: string
}

const PageHeader: React.FC<PageProps> = ({
  title,
  description,
  logo,
  isDividerVisible = true,
  backgroundColor = '#FFF',
  containerPadding = '0px'
}) => {
  return (
    <Stack
      spacing={2.5}
      width={'100%'}
      sx={{
        backgroundColor: backgroundColor,
        padding: containerPadding
      }}
    >
      <Stack direction={'row'} spacing={'10px'} alignItems='center'>
        <Avatar
          src={logo}
          alt={`${title} logo`}
          variant='square'
          sx={{ width: 45, height: 45, borderRadius: 3 }}
        />
        <Box>
          <Typography variant='h6' className='font-weight--700'>
            {title}
          </Typography>

          <Typography variant='body2' color='text.secondary'>
            {description}
          </Typography>
        </Box>
      </Stack>
      {isDividerVisible && (
        <Box>
          <Divider sx={{ mb: 2.5 }} />
        </Box>
      )}{' '}
    </Stack>
  )
}

export default PageHeader
