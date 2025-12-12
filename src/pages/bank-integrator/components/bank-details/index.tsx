import { Box, Button, Divider, Stack, Typography } from '@mui/material'
import styles from './selectBank.module.scss'
import { StatusChip } from 'src/pages/team-management/team-members/components/TeamMembers'
import AccountCard from './AccountCard'

const BankDetails = () => {
  return (
    <Box className={styles.selectYourBankRoot}>
      <Box className={styles.selectYourBankContainer}>
        <Box
          alignSelf='flex-start'
          sx={{ display: { xs: 'block', sm: 'none' } }}
        >
          <StatusChip status={'Active'} />
        </Box>
        <Box
          display={'flex'}
          gap={2.5}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          <img src='/assets/back-clr.svg' alt='back colored icon' />

          <Stack spacing={0.5}>
            <Typography variant='h5' fontWeight={700}>
              Barclays
            </Typography>
            <Box
              display='flex'
              gap={1}
              flexDirection={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
            >
              {/* Connected */}
              <Box display='flex' gap='10px'>
                <img
                  className='icon-dimension--24'
                  src='/assets/calendar.svg'
                  alt='calendar icon'
                />
                <Typography variant='body1'>
                  Connected on 17 Sept 2025
                </Typography>
              </Box>

              {/* Divider - hidden on mobile */}
              <Divider
                orientation='vertical'
                sx={{ display: { xs: 'none', sm: 'block' } }}
              />

              {/* Expires */}
              <Box display='flex' gap='10px'>
                <img src='/assets/calendar.svg' alt='calendar icon' />
                <Typography variant='body1'>Expires on 17 Sept 2025</Typography>
              </Box>
            </Box>
          </Stack>

          <Box
            alignSelf='flex-start'
            sx={{ display: { xs: 'none', sm: 'block' } }}
          >
            <StatusChip status={'Active'} />
          </Box>
        </Box>

        <Stack spacing={1} width={'100%'}>
          <Typography variant='body1'>Connected Accounts (2):</Typography>
          <Box className={styles.accountCardsContainer}>
            <AccountCard />
            <AccountCard />
          </Box>
        </Stack>
        <Box className={styles.accessPermissionContainer}>
          <Box display={'flex'} gap={'10px'}>
            <img src='/assets/wallet.svg' alt='wallet icon' />
            <Stack>
              <Typography variant='subtitle1' fontWeight={700}>
                Access Permissions
              </Typography>
              <Typography variant='caption' color='text.secondary'>
                Information Monai can access
              </Typography>
            </Stack>
          </Box>
          <Stack spacing={'10px'}>
            <Box display={'flex'} gap={'10px'} alignItems={'center'}>
              <img src='/assets/green-verify.svg' alt='wallet icon' />
              <Typography variant='subtitle1'>
                Account details and holder information
              </Typography>
            </Box>
            <Box display={'flex'} gap={'10px'} alignItems={'center'}>
              <img src='/assets/green-verify.svg' alt='wallet icon' />
              <Typography variant='subtitle1'>
                Current account balances{' '}
              </Typography>
            </Box>
            <Box display={'flex'} gap={'10px'} alignItems={'center'}>
              <img src='/assets/green-verify.svg' alt='wallet icon' />
              <Typography variant='subtitle1'>Transaction history </Typography>
            </Box>
          </Stack>
        </Box>
        <Box className={styles.disconnectContainer}>
          <Stack>
            <Typography variant='subtitle1' fontWeight={700} color='error.main'>
              Disconnect Bank
            </Typography>
            <Typography variant='caption' color='text.secondary'>
              Remove this bank connection from Monai
            </Typography>
          </Stack>
          <Button
            variant='contained'
            size='large'
            color='error'
            startIcon={
              <img src='/assets/disconnect.svg' alt='disconnect icon' />
            }
          >
            Disconnect Barclays
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

export default BankDetails
