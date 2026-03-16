import { Box, Button, Stack, Typography } from '@mui/material'
import styles from './connectBank.module.scss'
import { Step } from '../../BankIntegrator'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'

interface ConnectYourBankProps {
  goToStep: (step: Step) => void
}

const ConnectYourBank = ({ goToStep }: ConnectYourBankProps) => {
  const navigate = useNavigate()

  const handleConnectBank = () => {
    goToStep('select-bank')
  }

  return (
    <Box className={styles.contectYourBankRoot}>
      {/* Upload Statement Card */}
      <Box className={styles.contentWrapper}>
        <Box className={styles.cardContent}>
          <Stack spacing={1} alignItems={'center'}>
            <img
              src='/assets/upload-csv.svg'
              alt='bank icon'
              style={{ width: 'min(200px, 80vw)', height: 'auto' }}
            />
            <Typography variant='h5' fontWeight={700}>
              Upload Bank Statement
            </Typography>
            <Typography variant='body1' color='text.secondary'>
              Upload your bank statement (CSV). System will extract the
              transactions and will ask you to categorise them.
            </Typography>
          </Stack>
        </Box>

        <Stack spacing={2} alignItems='center' mt={4}>
          <Button
            size='large'
            variant='contained'
            className={styles.cardButton}
            onClick={() => navigate(paths.uploadBankStatement)}
          >
            Upload Statement
          </Button>
          <Box
            sx={{
              visibility: 'hidden'
            }}
          >
            none
          </Box>
        </Stack>
      </Box>

      {/* Connect Bank Card */}
      <Box className={styles.contentWrapper}>
        <Box className={styles.cardContent}>
          <Stack spacing={1} alignItems={'center'}>
            <img
              src='/assets/bank.svg'
              alt='bank icon'
              style={{ width: 'min(200px, 80vw)', height: 'auto' }}
            />
            <Typography variant='h5' fontWeight={700}>
              Connect Your Bank
            </Typography>
            <Typography variant='body1' color='text.secondary'>
              Securely link your bank to allow Monai to read balances and
              transactions.
            </Typography>
          </Stack>
        </Box>

        {/* Bottom section: button + Yapily */}
        <Stack spacing={2} alignItems='center' mt={4}>
          <Button
            size='large'
            variant='contained'
            className={styles.cardButton}
            onClick={handleConnectBank}
          >
            Link Bank Account
          </Button>

          <Box display='flex' gap={1.5} alignItems='center'>
            <img src='/assets/yapily.svg' alt='Yapily' style={{ height: 24 }} />
            <Typography color='text.secondary' variant='caption'>
              Powered by Yapily Connect
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Box>
  )
}

export default ConnectYourBank
