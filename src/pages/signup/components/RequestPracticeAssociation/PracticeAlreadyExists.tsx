import { Alert, Box, Button, Stack, Typography } from '@mui/material'
import styles from './PracticeAlreadyExists.module.scss'
import HavingTrouble from 'src/components/contact-support/HavingTrouble'
import { useNavigate } from 'react-router'

interface PracticeAlreadyExistsProps {
  setActiveStep: React.Dispatch<React.SetStateAction<number>>
  practiceName?: string
}

const PracticeAlreadyExists = ({
  setActiveStep,
  practiceName = ''
}: PracticeAlreadyExistsProps) => {
  const navigate = useNavigate()

  const handleContinue = () => {
    setActiveStep(5)
  }

  const handleCancel = () => {
    navigate('/auth/login')
  }

  return (
    <Stack className={styles.practiceAlreadyExistsRoot}>
      <img
        src='/assets/warning.svg'
        alt='warning icon'
        className='icon-dimension--88'
      />

      <Stack spacing={1}>
        <Typography variant='h4' color='text.primary' fontWeight={700}>
          Practice already exists
        </Typography>

        <Typography
          variant='subtitle1'
          color='var(--color-text-secondary)'
          sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}
        >
          The practice{' '}
          <strong className='text-color--primary'>{practiceName}</strong> is
          already registered in Monai Tech. If you’re also a{' '}
          <strong className='text-color--primary'>Practice Owner</strong> or{' '}
          <strong className='text-color--primary'>Company Director</strong>, you
          can send a request to the current practice admin for access approval.
        </Typography>

        <Alert severity='info'>
          <Typography
            className='alert-info-text font-weight--500'
            component='div'
            sx={{ margin: 0 }}
          >
            You’ll receive an email once your admin approves your request.
          </Typography>
        </Alert>
      </Stack>

      <Box sx={{ display: 'flex', gap: 2, width: '100%', flexWrap: 'wrap' }}>
        <Button
          variant='outlined'
          fullWidth
          size='large'
          onClick={handleCancel}
        >
          Cancel
        </Button>
        <Button
          type='button'
          variant='contained'
          fullWidth
          size='large'
          onClick={handleContinue}
        >
          Continue
        </Button>
      </Box>

      <HavingTrouble />
    </Stack>
  )
}

export default PracticeAlreadyExists
