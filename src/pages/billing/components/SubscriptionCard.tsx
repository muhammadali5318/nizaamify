import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  SxProps,
  Theme,
  CircularProgress
} from '@mui/material'
import { ReactNode, useEffect, useState } from 'react'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

export interface SubscriptionCardProps {
  icon?: ReactNode
  badgeIcon?: ReactNode | string
  tickIcon?: ReactNode | string

  title: string
  price: string
  priceSuffix?: string
  description?: string
  features: string[]
  buttonLabel: any
  onButtonClick?: (buttonLabel: string, title: string) => void
  buttonFontColor?: any
  backgroundColor?: any
  backgroundImage?: any
  textColor?: string
  buttonVariant?: string | any
  buttonColor?: string
  borderColor?: string
  sx?: SxProps<Theme>
  footerIcon?: string | any
  footerText?: string | any
  headerIcon?: any
  headerText?: any
  footerBgColor?: string | any
  buttonBorder?: string | any
  isSubscribed?: any
  subscriptionPlan?: string
  loading?: boolean
  cancelled_at?: any | null
  has_used_free_trial?: boolean
  has_free_trial_eligibility?: boolean
  showHeader?: boolean
  periodEndDate?: string | null
}

const SubscriptionCard = ({
  icon,
  badgeIcon,
  tickIcon,
  title,
  price,
  priceSuffix = '/month',
  description,
  features,
  buttonLabel,
  onButtonClick,
  backgroundImage,
  backgroundColor,
  buttonBorder,
  textColor = '#fff',
  buttonVariant = 'contained',
  buttonColor = 'primary',
  borderColor = 'rgba(255,255,255,0.2)',
  sx,
  footerIcon,
  footerText,
  footerBgColor,
  buttonFontColor,
  isSubscribed,
  loading,
  has_free_trial_eligibility,
  has_used_free_trial,
  cancelled_at,
  periodEndDate
}: SubscriptionCardProps) => {
  let isDisabled = false
  if (buttonLabel === 'Current Plan') {
    isDisabled = true
  } else isDisabled = false

  const [headerText, setHeaderText] = useState('')
  useEffect(() => {
    if (cancelled_at !== null) {
      setHeaderText(
        `Your subscription has been cancelled. You can continue using the service until the end of your billing period ${periodEndDate}, or reactivate anytime.`
      )
    } else if (
      has_free_trial_eligibility === false ||
      has_used_free_trial === true ||
      cancelled_at == null
    ) {
      setHeaderText(
        'Your free trial has ended. Subscribe to the Professional plan to continue accessing advanced insights and tools to manage finances effectively.'
      )
    } else {
      setHeaderText('')
    }
  }, [cancelled_at, has_free_trial_eligibility, has_used_free_trial])

  return (
    <Card
      sx={{
        backgroundImage: backgroundImage
          ? `url(${backgroundImage})`
          : undefined,
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundColor,
        color: textColor,
        borderRadius: '24px',
        border: `1px solid ${borderColor}`,
        p: 1,
        width: '100%',
        minWidth: 300,
        mx: 'auto',
        ...sx
      }}
    >
      {cancelled_at != null && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '5px',
            borderRadius: '12px',
            paddingLeft: '10px',
            backgroundColor: cancelled_at ? '#D32F2F' : '#0288D1',
            marginLeft: '5px',
            marginRight: '5px',
            color: '#fff'
          }}
        >
          <InfoOutlinedIcon
            sx={{ fontSize: 20, cursor: 'pointer', color: '#fff' }}
          />
          <p>{headerText}</p>
        </Box>
      )}

      <CardContent>
        {/* Parent Flex Container */}
        <Box
          display='flex'
          flexDirection={{ xs: 'column', md: 'row' }}
          justifyContent='space-between'
          alignItems={{ xs: 'flex-start', md: 'center' }}
          gap={4}
        >
          {/* LEFT SIDE */}
          <Box flex={1} mb={2}>
            {/* Title & Icon */}
            <Box
              display='flex'
              flexDirection='column'
              alignItems='start'
              gap={1}
            >
              <Box>
                {typeof badgeIcon === 'string' ? (
                  <img src={badgeIcon} alt='badge' />
                ) : (
                  <>{badgeIcon}</>
                )}
              </Box>
              {icon && <Box sx={{ fontSize: 32 }}>{icon}</Box>}
              <Typography variant='h5' fontWeight={700}>
                {title}
              </Typography>
            </Box>

            {/* Description */}
            {description && (
              <Typography variant='body1' mt={1}>
                {description}
              </Typography>
            )}

            {/* Price */}
            <Typography variant='h3' fontWeight={800} mt={2}>
              {price}
              <Typography
                component='span'
                variant='h6'
                sx={{ opacity: 0.8, ml: 1 }}
              >
                {priceSuffix}
              </Typography>
            </Typography>

            {/* Button */}
          </Box>

          {/* RIGHT SIDE — Features */}
          <Box flex={1}>
            <Typography variant='h5' fontWeight={700} mb={1}>
              Features
            </Typography>

            <Box>
              {features?.map((feature, index) => (
                <Typography
                  sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 1
                  }}
                  key={index}
                  variant='body2'
                >
                  <p>{tickIcon}</p>
                  <p> {feature}</p>
                </Typography>
              ))}
            </Box>
          </Box>
        </Box>
        {isDisabled == false ? (
          <Button
            variant={buttonVariant}
            onClick={() => onButtonClick?.(buttonLabel, title)}
            sx={{
              mt: 3,
              py: 1,
              borderRadius: '12px',
              color: buttonFontColor,
              borderColor: buttonBorder,
              width: { xs: '100%', sm: '100%', md: '100%', lg: '50%' },
              backgroundColor: buttonColor
            }}
          >
            {loading ? <CircularProgress size={22} /> : buttonLabel}
          </Button>
        ) : (
          <Button
            variant={buttonVariant}
            disabled={loading}
            sx={{
              mt: 3,
              py: 1,
              borderRadius: '12px',
              width: { xs: '100%', sm: '100%', md: '100%', lg: '50%' },
              backgroundColor: buttonColor,
              borderColor: '#4f4f4f',
              color: '#4f4f4f'
            }}
          >
            {loading ? <CircularProgress size={22} /> : buttonLabel}
          </Button>
        )}

        {isSubscribed == false ||
          (buttonLabel !== 'Subscribe' && (
            <Box
              sx={{
                border: '1px solid #fff',
                borderRadius: '12px',
                padding: '1px',
                paddingLeft: '12px',
                paddingTop: '0px',
                paddingBottom: '0px',
                marginTop: '20px',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 1,
                backgroundColor: footerBgColor
              }}
            >
              <>{footerIcon}</>
              <p>{footerText}</p>
            </Box>
          ))}
      </CardContent>
    </Card>
  )
}

export default SubscriptionCard
