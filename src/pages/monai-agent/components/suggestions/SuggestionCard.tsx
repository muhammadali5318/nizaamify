import { Box, Card, Typography } from '@mui/material'

interface Props {
  text: string
  iconSrc?: string
  onClick?: () => void
}

const SuggestionCard = ({ text, iconSrc, onClick }: Props) => {
  return (
    <Card
      variant='outlined'
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        borderRadius: '16px',
        height: '100%',
        backgroundColor: '#FAFAFA',
        borderColor: 'grey.200',
        transition: 'all 0.2s ease',
        '&:hover': {
          backgroundColor: '#FFFFFF',
          boxShadow: '0px 4px 12px rgba(0,0,0,0.06)',
          borderColor: 'grey.300',
          transform: 'translateY(-2px)'
        }
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 1.5,
          py: 1
        }}
      >
        {/* SVG Icon */}
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fff',
            flexShrink: 0
          }}
        >
          {iconSrc && (
            <Box
              component='img'
              src={iconSrc}
              alt='suggestion icon'
              sx={{
                width: 22,
                height: 22
              }}
            />
          )}
        </Box>

        {/* Text */}
        <Typography
          variant='body2'
          sx={{
            fontWeight: 500,
            lineHeight: 1.4,
            color: 'text.primary'
          }}
        >
          {text}
        </Typography>
      </Box>
    </Card>
  )
}

export default SuggestionCard
