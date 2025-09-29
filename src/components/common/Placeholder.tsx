import { Box, Typography } from '@mui/material'

type PlaceholderProps = {
  title: string
}

const Placeholder = ({ title }: PlaceholderProps) => {
  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <Typography variant='h4'>Information Here</Typography>
        <Typography variant='body1' color='var(--text-secondary)'>
          {title} view here soon
        </Typography>
      </Box>
    </Box>
  )
}

export default Placeholder
