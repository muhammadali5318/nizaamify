import React from 'react'
import { Box, CircularProgress, Chip, Typography, Button } from '@mui/material'

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
  const config: Record<string, { icon: string; bg: string; color: string }> = {
    Active: {
      icon: '/assets/green-verify-circle.svg',
      bg: 'rgba(76, 175, 80, 0.15)',
      color: 'var(--color-success-main)'
    },
    Inactive: {
      icon: '/assets/error-outlined.svg',
      bg: 'rgba(239, 83, 80, 0.15)',
      color: 'var(--color-error-main)'
    },
    Pending: {
      icon: '/assets/pending-circle.svg',
      bg: 'rgba(255, 152, 0, 0.15)',
      color: 'var(--color-warning-main)'
    }
  }

  const { icon, bg, color } = config[status] || config['Pending']

  return (
    <Chip
      icon={<Box component='img' src={icon} alt={status} />}
      label={status}
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
}
export const NoResultsBox: React.FC<NoResultsBoxProps> = ({
  loading,
  searchKey,
  onClear,
  noSearchText
}) => {
  if (loading) {
    return (
      <Box className='no-result-found'>
        <CustomLoader />
      </Box>
    )
  }

  const hasQuery = Boolean(searchKey && searchKey.length > 0)
  return (
    <Box className='no-result-found'>
      <Box className='no-result-found-typography'>
        <Typography variant='body2'>
          {hasQuery
            ? `Your search for '${searchKey}' did not match any results.`
            : (noSearchText ?? 'Your search did not match any results.')}
        </Typography>
        <Typography variant='body2'>
          Please try again with different keywords or adjust the filters.
        </Typography>
      </Box>
      <Button variant='outlined' onClick={onClear}>
        Clear All Filter
      </Button>
    </Box>
  )
}
