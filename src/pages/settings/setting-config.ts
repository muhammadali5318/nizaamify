// src/config/settingsMenu.ts

import PracticeInformation from './component/PracticeInformation'
import ProfileInformation from './component/ProfileInformation'
import Security from './component/Security'
import SubscriptionBilling from './component/SubscriptionBilling'
import { MenuItem } from './type'

export const SETTINGS_MENU: MenuItem[] = [
  {
    id: 'profile',
    label: 'Profile information',
    title: 'Profile information',
    description:
      'Manage your personal details and keep your account information up to date.',
    logo: '/assets/profile.svg',
    component: ProfileInformation
  },
  {
    id: 'practice',
    label: 'Practice information',
    title: 'Practice information',
    description: 'Update your practice details and settings.',
    logo: '/assets/practice-settings.svg',
    component: PracticeInformation
  },
  {
    id: 'billing',
    label: 'Subscription/Billing',
    title: 'Subscription & Billing',
    description: 'Plan, invoices, payment methods.',
    logo: '/assets/logo-billing.svg',
    component: SubscriptionBilling
  },
  {
    id: 'security',
    label: 'Security',
    title: 'Security',
    description: 'Manage your password and account protection settings.',
    logo: '/assets/security.svg',
    component: Security
  }
]
