import { Box, Divider, Typography, Menu, MenuItem, Button } from '@mui/material'
import poundIcon from '../../../assets/pound-icon.svg'
import calendarIcon from '../../../assets/calendar-icon.svg'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { useState } from 'react'
import ArchivePractice from '../../practice-settings/components/ArchivePracticeModal'
import CancelSubscriptionStepper from '../cancellation/CancelSubscriptionStepper'
import CloseIcon from '@mui/icons-material/Close'
import React from 'react'

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
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2
        }}
      >
        <img src={poundIcon} alt='pound' />
        <Box>
          <Typography variant='h6'>Payment Settings</Typography>
          <Typography variant='body2'>
            Payments will be automatically deducted on the billing date
          </Typography>
        </Box>
      </Box>

      {/* PAYMENT CARD */}
      <Box
        sx={{
          border: '1px solid #EEEEEE',
          borderRadius: '12px',
          padding: 1,
          mt: 2,
          backgroundColor: '#FAFAFA'
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          {/* Left */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <img src={calendarIcon} alt='calendar' />
            <Box>
              <Typography variant='h6' sx={{ fontSize: '16px' }}>
                Next payment date
              </Typography>
              <Typography variant='body2' sx={{ color: '#898989' }}>
                Your subscription will renew on
              </Typography>
            </Box>

            <Divider
              orientation='vertical'
              flexItem
              sx={{ height: 44, mx: 1 }}
            />

            <Typography variant='body2'>
              Due by:<strong> {billingDate}</strong>
            </Typography>

            <Divider
              orientation='vertical'
              flexItem
              sx={{ height: 44, mx: 1 }}
            />

            <Typography variant='body2'>
              Amount:<strong> £{subscriptionPlanAmount}.00</strong>
            </Typography>
          </Box>

          {/* Menu Trigger */}
          <Box sx={{ cursor: 'pointer' }} onClick={handleMenuOpen}>
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
                color: '#D32F2F',
                boxShadow: 'none'
              }
            }}
            size='small'
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
