import { Alert, Box, Button, Stack, Typography, useTheme } from '@mui/material'
import styles from './signupSupscriptionCard.module.scss'
import SubscriptionType from './SubscriptionType'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { useLocation } from 'react-router'
import { useState } from 'react'
import { notify } from '../notistack/NotificationProvider'

export interface SignupSupscriptionCardProps {
  mode?: 'light' | 'dark'
  title: string
  subtitle?: string
  price: string | number
  priceSuffix?: string
  description?: string
  benefits?: string[]
  headerIcon?: string
  tickIconLight?: string
  tickIconDark?: string
  buttonTitle?: string
  planType: string
}

const SignupSupscriptionCard: React.FC<SignupSupscriptionCardProps> = ({
  mode = 'light',
  title,
  subtitle,
  price,
  priceSuffix = '/ Month',
  buttonTitle,
  description,
  benefits = [],
  headerIcon = '/assets/clock-bg-grey.svg',
  tickIconLight = '/assets/ticket-icon-black.svg',
  tickIconDark = '/assets/ticket-icon-white.svg',
  planType
}) => {
  const theme = useTheme()
  const { search } = useLocation()
  const fixedSearch = search.replace(/\+/g, '%2B')
  const practiceId = new URLSearchParams(fixedSearch).get('practiceId')
  const email = new URLSearchParams(fixedSearch).get('email')
  const [loading, setLoading] = useState(false)

  const isDark = mode === 'dark'

  const cardStyles = {
    background: isDark ? '#000' : theme.palette.grey[50],
    color: isDark ? theme.palette.common.white : theme.palette.text.primary
  }

  const tickIcon = isDark ? tickIconDark : tickIconLight

  const goToStripCheck = async () => {
    setLoading(true)
    try {
      const resp = await apiClient.post(endpoints.subscription.checkoutUrl, {
        email,
        practice_id: practiceId,
        plan_type: planType
      })
      const url = resp?.data?.data?.checkout_url
      if (!url) {
        notify.error('Checkout URL not found')
        return
      }
      window.location.assign(url)
    } catch (error) {
      notify.error('Something went wrong, please try again later.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Stack
      className={styles.signupSupscriptionCardRoot}
      style={cardStyles}
      alignItems='flex-start'
    >
      {!isDark ? (
        <SubscriptionType
          label='Most Popular'
          background='linear-gradient(90deg, #00C950 0%, #009966 100%)'
          iconSrc='/assets/transparent-star.svg'
          textColor='#fff'
        />
      ) : (
        <SubscriptionType
          label='Premium'
          background='linear-gradient(90deg, #9810FA 0%, #E60076 100%)'
          iconSrc='/assets/premium-star.svg'
          textColor='#fff'
        />
      )}
      <img src={headerIcon} alt='card background' />

      <Stack spacing={2.5}>
        <Stack spacing={1}>
          <Box display={'flex'} gap={1} alignItems={'center'}>
            <Typography fontWeight={700} variant='h5'>
              {title}
            </Typography>
            {subtitle && (
              <Typography
                fontStyle='italic'
                fontWeight={700}
                variant='body1'
                color='success.light'
              >
                {subtitle}
              </Typography>
            )}
          </Box>

          <Typography variant='body1'>{description}</Typography>
        </Stack>

        <Stack>
          <Box display={'flex'} gap={1} alignItems={'center'}>
            <Typography fontWeight={700} variant='h2'>
              £{price}
            </Typography>
            <Typography variant='body1'>{priceSuffix}</Typography>
          </Box>
          <Button
            onClick={() => goToStripCheck()}
            loading={loading}
            disabled={loading}
            sx={{
              background: '#fff',
              color: 'black'
            }}
            variant='outlined'
          >
            {buttonTitle}
          </Button>
        </Stack>
      </Stack>

      <Stack spacing={1.5}>
        {benefits.map((b, index) => (
          <Box key={index} className={styles.benefitsRow}>
            <img src={tickIcon} alt='tick' />
            <Typography>{b}</Typography>
          </Box>
        ))}
        {!isDark && (
          <Alert severity='info' className='alert-info-container'>
            <Typography
              className='alert-info-text font-weight--700'
              component='div'
              sx={{ margin: 0 }}
            >
              Credit Card details required for Free Trial. We won’t charge you
              anything till the trial expires.
            </Typography>
          </Alert>
        )}
      </Stack>
    </Stack>
  )
}

export default SignupSupscriptionCard
