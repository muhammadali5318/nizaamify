import { Box, Divider, Typography, Menu, MenuItem, Button } from '@mui/material'
import poundIcon from '../../../assets/pound-icon.svg'
import calendarIcon from '../../../assets/calendar-icon.svg'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { useState } from 'react'
import ArchivePractice from '../../practice-settings/components/ArchivePracticeModal'
import CancelSubscriptionStepper from '../cancellation/CancelSubscriptionStepper'
import CloseIcon from '@mui/icons-material/Close'

type PaymentSettingsProps = {
  subscriptionPlanAmount?: string | number
  billingDate?: any
}

const PaymentSettings: React.FC<PaymentSettingsProps> = ({
  subscriptionPlanAmount,
  billingDate
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [openCancelModal, setOpenCancelModal] = useState(false)

  const handleMenuOpen = (e: React.MouseEvent<HTMLDivElement>) =>
    setAnchorEl(e.currentTarget)

  const handleMenuClose = () => setAnchorEl(null)

  const handleCancelSubscription = () => {
    handleMenuClose()
    setOpenCancelModal(true)
  }

  return (
    <>
      {/* HEADER */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2
        }}
      >
        <img src={poundIcon} alt='pound' />
        <Box>
          <Typography variant='h6' fontSize={{ xs: '16px', sm: '18px' }}>
            Payment Settings
          </Typography>
          <Typography variant='body2' sx={{ color: '#757575' }}>
            Payments will be automatically deducted on the billing date
          </Typography>
        </Box>
      </Box>

      {/* PAYMENT CARD */}
      <Box
        sx={{
          border: '1px solid #EEEEEE',
          borderRadius: '12px',
          padding: 2,
          mt: 2,
          backgroundColor: '#FAFAFA'
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: { xs: 2, md: 0 }
          }}
        >
          {/* LEFT BLOCK */}
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 2
            }}
          >
            <img src={calendarIcon} alt='calendar' />

            <Box>
              <Typography variant='h6' fontSize='16px'>
                Next payment date
              </Typography>
              <Typography variant='body2' sx={{ color: '#898989' }}>
                Your subscription will renew on
              </Typography>
            </Box>

            {/* Divider only visible on md+ */}
            <Divider
              orientation='vertical'
              flexItem
              sx={{ display: { xs: 'none', md: 'block' }, mx: 1, height: 44 }}
            />

            <Typography variant='body2'>
              Due by:
              <strong> {billingDate}</strong>
            </Typography>

            <Divider
              orientation='vertical'
              flexItem
              sx={{ display: { xs: 'none', md: 'block' }, mx: 1, height: 44 }}
            />

            <Typography variant='body2'>
              Amount:
              <strong> £{subscriptionPlanAmount}.00</strong>
            </Typography>
          </Box>

          {/* MENU BUTTON */}
          <Box
            sx={{
              alignSelf: { xs: 'flex-end', md: 'center' },
              cursor: 'pointer'
            }}
            onClick={handleMenuOpen}
          >
            <MoreVertIcon />
          </Box>
        </Box>
      </Box>

      {/* MENU */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleCancelSubscription}>
          <Button
            sx={{
              color: '#D32F2F',
              '&:hover': {
                backgroundColor: 'transparent',
                color: '#D32F2F'
              }
            }}
            startIcon={<CloseIcon />}
          >
            Cancel Subscription
          </Button>
        </MenuItem>
      </Menu>

      <ArchivePractice
        open={openCancelModal}
        onClose={() => setOpenCancelModal(false)}
        steps={[
          {
            label: 'Verify your identity',
            Component: CancelSubscriptionStepper.Step1
          },
          {
            label: 'Reason of cancellation',
            Component: CancelSubscriptionStepper.Step2
          }
        ]}
      />
    </>
  )
}

export default PaymentSettings
