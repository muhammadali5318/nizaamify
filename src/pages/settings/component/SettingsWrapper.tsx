// src/components/common/Panel.tsx
import React from 'react'
import { Box, Stack, Avatar, Typography, Divider } from '@mui/material'
import { SettingsWrapperProps } from '../type'

const SettingsWrapper: React.FC<SettingsWrapperProps> = ({
  title,
  description,
  logo,
  children
}) => {
  return (
    <Stack spacing={2.5}>
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

      <Divider />

      <>{children}</>
    </Stack>
  )
}

export default SettingsWrapper
