import { Box, Button, Typography } from '@mui/material'
import { useAuth } from 'src/context/AuthProvider'
import { useInitialData } from 'src/hooks/useFetchInitialData'
import { queryClient } from 'src/utils/queryClient'

type PlaceholderProps = {
  title: string
}

const Placeholder = ({ title }: PlaceholderProps) => {
  const { accessToken } = useAuth()
  const { data: practice } = useInitialData(!!accessToken)

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
        <Button
          onClick={() =>
            queryClient.refetchQueries({ queryKey: ['initialData'] })
          }
        >
          {practice?.practice_name}
        </Button>
      </Box>
    </Box>
  )
}

export default Placeholder
