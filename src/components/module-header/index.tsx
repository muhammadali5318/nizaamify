import React from 'react'
import {
  Box,
  Stack,
  Typography,
  TypographyProps,
  SxProps,
  Theme,
  Tooltip
} from '@mui/material'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'

export interface ModuleHeaderProps {
  avatarSrc: string
  heading: string
  subheading?: string
  avatarSize?: number
  headingVariant?: TypographyProps['variant']
  subheadingVariant?: TypographyProps['variant']
  variant?: TypographyProps['variant']
  imgAlt?: string
  gap?: number
  tooltipText?: string
  sx?: SxProps<Theme>
}

const ModuleHeader: React.FC<ModuleHeaderProps> = ({
  avatarSrc,
  heading,
  subheading,
  avatarSize = 48,
  headingVariant = 'h6',
  subheadingVariant = 'body1',
  variant,
  imgAlt,
  sx,
  gap = 0.5,
  tooltipText
}) => {
  const resolvedHeadingVariant: TypographyProps['variant'] = (variant ??
    headingVariant) as TypographyProps['variant']

  return (
    <Box display='flex' alignItems='center' gap={2} sx={sx}>
      <Box
        component='img'
        src={avatarSrc}
        alt={imgAlt ?? heading}
        sx={{
          width: avatarSize,
          height: avatarSize,
          objectFit: 'cover',
          borderRadius: 1,
          flexShrink: 0
        }}
      />

      <Stack spacing={gap}>
        <Box display={'flex'} alignItems={'center'} gap={2}>
          <Typography variant={resolvedHeadingVariant} fontWeight={700}>
            {heading}
          </Typography>

          {tooltipText && (
            <Tooltip title={tooltipText} arrow placement='top'>
              <HelpOutlineIcon
                sx={{
                  color: 'var(--color-primary-black)',
                  cursor: 'pointer'
                }}
                aria-hidden={false}
                role='img'
              />
            </Tooltip>
          )}
        </Box>

        {subheading && (
          <Typography variant={subheadingVariant} color='text.secondary'>
            {subheading}
          </Typography>
        )}
      </Stack>
    </Box>
  )
}

export default ModuleHeader
