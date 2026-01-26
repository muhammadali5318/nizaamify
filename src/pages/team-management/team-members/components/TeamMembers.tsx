import React from 'react'
import { Box, CircularProgress, Chip, Typography, Button } from '@mui/material'
import { toTitleCase } from 'src/utils/stringUtils'

type ImgIconProps = { src: string; alt?: string; size?: number }
export const ImgIcon: React.FC<ImgIconProps> = ({
  src,
  alt = '',
  size = 18
}) => (
  <Box
    component='img'
    src={src}
    alt={alt}
    sx={{ width: size, height: size, display: 'block' }}
  />
)

export const CustomLoader: React.FC<{ backgroundColor?: string }> = () => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      py: 4
    }}
  >
    <CircularProgress />
  </Box>
)

type StatusChipProps = { status: string }
export const StatusChip: React.FC<StatusChipProps> = ({ status }) => {
  const normalizedStatus = status?.toUpperCase?.() || ''

  const config: Record<string, { icon: string; bg: string; color: string }> = {
    ACTIVE: {
      icon: '/assets/green-verify-circle.svg',
      bg: 'rgba(76, 175, 80, 0.15)',
      color: 'var(--color-success-main)'
    },
    INACTIVE: {
      icon: '/assets/error-outlined.svg',
      bg: 'rgba(239, 83, 80, 0.15)',
      color: 'var(--color-error-main)'
    },
    INVITED: {
      icon: '/assets/pending-circle.svg',
      bg: 'rgba(255, 152, 0, 0.15)',
      color: 'var(--color-warning-main)'
    },
    'RESEND INVITE': {
      icon: '/assets/re-sync-error.svg',
      bg: 'rgba(239, 83, 80, 0.15)',
      color: 'var(--color-error-main)'
    }
  }

  const fallback = {
    icon: '/assets/pending-circle.svg',
    bg: 'rgba(255, 152, 0, 0.15)',
    color: 'var(--color-warning-main)'
  }

  const { icon, bg, color } = config[normalizedStatus] ?? fallback

  return (
    <Chip
      icon={<Box component='img' src={icon} alt={status} />}
      label={toTitleCase(status)}
      sx={{
        backgroundColor: bg,
        color,
        textTransform: 'capitalize',
        fontSize: '13px',
        borderRadius: '16px',
        height: 24,
        '& .MuiChip-icon': {
          color,
          ml: 0.5
        }
      }}
    />
  )
}

type NoResultsBoxProps = {
  loading: boolean
  searchKey: string
  onClear: () => void
  noSearchText?: string
  isAnyFilterApplied?: boolean | undefined
}
export const NoResultsBox: React.FC<NoResultsBoxProps> = ({
  loading,
  searchKey,
  onClear,
  isAnyFilterApplied
}) => {
  if (loading) {
    return (
      <Box className='no-result-found'>
        <CustomLoader />
      </Box>
    )
  }

  if (!isAnyFilterApplied) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'text.secondary'
        }}
      >
        <Typography variant='body2'>No data available.</Typography>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center'
      }}
    >
      <Box>
        <Typography variant='body2'>
          {searchKey ? (
            <>
              Your search for <strong>&apos;{searchKey}&apos;</strong> did not
              match any results.
            </>
          ) : (
            'Your filters did not match any results.'
          )}
        </Typography>

        <Typography variant='body2'>
          Try adjusting or clearing your filters.
        </Typography>
      </Box>

      <Button variant='outlined' onClick={onClear}>
        Clear All Filters
      </Button>
    </Box>
  )
}
