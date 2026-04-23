import { Box, Paper, Stack, Typography } from '@mui/material'

type PlaceholderProps = {
  title: string
  description?: string
  icon?: string
}

const Placeholder = ({
  title,
  description = `${title} module is ready to be customized. Content coming soon.`,
  icon
}: PlaceholderProps) => {
  return (
    <Box
      sx={{
        minHeight: '100%',
        width: '100%',
        p: { xs: 3, md: 4 }
      }}
    >
      <Paper
        elevation={0}
        sx={{
          minHeight: 'calc(100vh - 180px)',
          borderRadius: '24px',
          border: '1px solid var(--grey-200)',
          background:
            'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(245,245,245,0.75) 100%)',
          p: { xs: 3, md: 5 },
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <Stack
          spacing={2}
          alignItems='center'
          textAlign='center'
          sx={{ maxWidth: 560 }}
        >
          {icon && (
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--grey-100)',
                border: '1px solid var(--grey-200)'
              }}
            >
              <Box
                component='img'
                src={icon}
                alt={`${title} icon`}
                sx={{ width: 32, height: 32 }}
              />
            </Box>
          )}

          <Typography
            variant='overline'
            sx={{
              letterSpacing: '0.12em',
              color: 'var(--color-primary-light)'
            }}
          >
            Starter Template
          </Typography>
          <Typography variant='h4' className='font-weight--700'>
            {title}
          </Typography>
          <Typography variant='body1' color='text.secondary'>
            {description}
          </Typography>
        </Stack>
      </Paper>
    </Box>
  )
}

export default Placeholder
