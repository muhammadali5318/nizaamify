import React from 'react'
import { Box, Stack, Typography } from '@mui/material'

interface ModuleHeaderProps {
  /** Path or URL to custom SVG or image (e.g., /assets/logo.svg) */
  avatarSrc: string
  /** Main heading text */
  heading: string
  /** Subheading text (optional) */
  subheading?: string
  /** Avatar size in pixels (optional, default = 48) */
  avatarSize?: number
}

const ModuleHeader: React.FC<ModuleHeaderProps> = ({
  avatarSrc,
  heading,
  subheading
}) => {
  return (
    <Box display='flex' alignItems='center' gap={2}>
      <img src={avatarSrc} alt={heading} />
      <Stack spacing={0.5}>
        <Typography variant='h6' fontWeight={700}>
          {heading}
        </Typography>
        {subheading && (
          <Typography variant='body1' color='text.secondary'>
            {subheading}
          </Typography>
        )}
      </Stack>
    </Box>
  )
}

export default ModuleHeader
