import { Box, Typography, Button } from '@mui/material'
import styles from './Congratulations.module.scss'
import { useNavigate } from 'react-router'

type CongratulationsProps = {
  title?: string
  showDisclaimer?: boolean
  message: string
  onContinue?: () => void
}

const Congratulations: React.FC<CongratulationsProps> = ({
  title = 'Congratulations!',
  message,
  showDisclaimer = false,
  onContinue
}) => {
  const navigate = useNavigate()

  const handleDefaultContinue = () => {
    navigate('/auth/login')
  }

  return (
    <Box
      className={styles.congratulationsContainer}
      sx={{
        width: { xs: '100%', md: '636px' },
        mx: 'auto',
        px: { xs: 3, md: '48px' },
        py: { xs: 3, md: '36px' }
      }}
    >
      <Box className='center-align-width--100'>
        <Box
          component='img'
          src='/assets/congrats.svg'
          alt='congrat icon'
          sx={{
            width: { xs: '120px', sm: '150px', md: 'auto' },
            maxWidth: '100%',
            height: 'auto',
            display: 'block'
          }}
        />
      </Box>

      <Box className={styles.congratsInfoContainer}>
        <Typography variant='h4' className='font-weight--700' align='center'>
          {title}
        </Typography>

        <Typography
          variant='subtitle1'
          color='var(--color-text-secondary)'
          sx={{
            width: { xs: '100%', md: '364px' },
            maxWidth: '100%',
            textAlign: 'center',
            wordBreak: 'break-word'
          }}
        >
          {message}
        </Typography>
        {showDisclaimer && (
          <Box
            sx={{
              mt: 2,
              px: 2,
              py: 1.5,
              borderRadius: '12px',
              backgroundColor: 'rgba(0, 0, 0, 0.03)',
              textAlign: 'center'
            }}
          >
            <Typography
              variant='body2'
              sx={{
                color: 'var(--color-text-secondary)',
                fontWeight: 500
              }}
            >
              For added security, you will be prompted to set up Multi-Factor
              Authentication (MFA) upon your first login.
            </Typography>
          </Box>
        )}
      </Box>

      <Box className='center-align-width--100'>
        <Button
          size='large'
          variant='contained'
          className={styles.continueBtn}
          onClick={onContinue ?? handleDefaultContinue}
          sx={{
            width: { xs: '100%', md: '210px' }
          }}
        >
          Continue
        </Button>
      </Box>
    </Box>
  )
}

export default Congratulations
