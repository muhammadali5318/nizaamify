import StarImg from '../../../assets/SubscriptionStar.svg'
import cardBg from '../../../assets/subs-card-bg.svg'
import badgeIcon from '../../../assets/premium-Badge.svg'
import tickImg from '../../../assets/tick-sub.svg'

import freeBadge from '../../../assets/free-badge.svg'
import freeTick from '../../../assets/free-tick.svg'
import freeClock from '../../../assets/free-clock.svg'
import freeWarning from '../../../assets/free-warning.svg'
import stripeImg from '../../../assets/Stripe wordmark.svg'

// -------------------------------------------
// PROFESSIONAL PLAN (dynamic)
// -------------------------------------------

export const getSubscribedPlan = (activePractice: any) => {
  const subscriptionPlan =
    activePractice?.subscription_details?.subscription_plan_name

  let proBtnText = ''
  let freeBtnText = ''

  if (subscriptionPlan === 'PROFESSIONAL') {
    proBtnText = 'Current Plan'
  } else if (subscriptionPlan === 'FREE TRIAL') {
    proBtnText = 'Upgrade to professional plan'
    freeBtnText = 'Current Plan'
  } else {
    proBtnText = 'Subscribe to professional plan'
    freeBtnText = 'Subscribe'
  }

  return {
    badgeIcon,
    icon: <img src={StarImg} alt='star' />,
    tickIcon: <img src={tickImg} alt='tick' />,
    title: 'Professional Plan',
    price: '£99',
    priceSuffix: '/Month',
    description:
      'Ideal for practices needing insights and tools to manage finances.',
    features: [
      'Full KPI dashboard & benchmarking insights',
      'AI-powered financial assistant',
      'Drag & drop uploads with OCR',
      'Downloadable monthly & annual reports',
      'Priority customer support'
    ],
    buttonLabel: proBtnText,
    buttonVariant: 'outlined',
    buttonColor: 'secondary',
    backgroundImage: cardBg,
    backgroundColor: '#000',
    textColor: '#fff',
    borderColor: 'rgba(255,255,255,0.2)',
    buttonBorder: '#fff',
    buttonFontColor: '#fff',
    footerText: '| Payments securely processed by Stripe.',
    footerIcon: <img src={stripeImg} alt='stripe' />,
    footerBgColor: '#000',
    freeBtnText
  }
}

export const getFreePlan = (activePractice: any) => {
  const subscriptionPlan =
    activePractice?.subscription_details?.subscription_plan_name

  let proBtnText = ''
  let freeBtnText = ''

  if (subscriptionPlan === 'PROFESSIONAL') {
    proBtnText = 'Current Plan'
  } else if (subscriptionPlan === 'FREE TRIAL') {
    proBtnText = 'Upgrade to professional plan'
    freeBtnText = 'Current Plan'
  } else {
    proBtnText = 'Subscribe to professional plan'
    freeBtnText = 'Subscribe'
  }

  return {
    badgeIcon: freeBadge,
    icon: <img src={freeClock} alt='clock' />,
    tickIcon: <img src={freeTick} alt='tick' />,
    title: 'Free trial',
    price: '£0',
    priceSuffix: '/Month',
    description:
      'Ideal for individuals who want to explore Monai with no upfront commitment.',
    trialDays: '30 Days',
    features: [
      '30 days full access to MonAI platform',
      'Access to all core features',
      'Complete financial dashboard',
      'AI-powered insights',
      'Priority customer support',
      'Cancel anytime, no charges'
    ],
    buttonLabel: freeBtnText,
    buttonVariant: 'outlined',
    buttonColor: '#fff',
    backgroundImage: null,
    backgroundColor: '#fff',
    textColor: '#000',
    borderColor: '#E0E0E0',
    buttonBorder: '#000',
    buttonFontColor: '#000',
    footerIcon: <img src={freeWarning} alt='warning' />,
    footerText: '8 days left till expiry date',
    footerBgColor: '#FFF8E1'
  }
}
