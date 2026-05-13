import type { SvgIconComponent } from '@mui/icons-material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import PointOfSaleIcon from '@mui/icons-material/PointOfSale'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import GroupIcon from '@mui/icons-material/Group'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import StoreIcon from '@mui/icons-material/Store'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import TrackChangesIcon from '@mui/icons-material/TrackChanges'
import AssessmentIcon from '@mui/icons-material/Assessment'
import SettingsIcon from '@mui/icons-material/Settings'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import PeopleAltIcon from '@mui/icons-material/PeopleAltOutlined'
import { useTranslation } from 'react-i18next'
import { paths } from 'src/paths'
import { RBAC_TEAM_UI_ENABLED } from 'src/lib/featureFlags'
import { usePermission } from 'src/lib/permissions'

type NavItem = {
  to: string
  label: string
  icon: SvgIconComponent
}

type NavSection = {
  title: string
  items: NavItem[]
}

export function useNavSections(): NavSection[] {
  const { t } = useTranslation('common')
  // Team entry gated on both the feature flag (B.9 pilot rollout) and the
  // view_team permission. Owners on a pilot deploy see it; everyone else
  // doesn't even know it exists.
  const canViewTeam = usePermission('view_team')

  const settingsItems: NavItem[] = [
    { to: paths.settings, label: 'Settings', icon: SettingsIcon }
  ]
  if (RBAC_TEAM_UI_ENABLED && canViewTeam) {
    settingsItems.push({ to: paths.team, label: 'Team', icon: PeopleAltIcon })
  }
  settingsItems.push({
    to: paths.support,
    label: 'Support',
    icon: HelpOutlineIcon
  })

  return [
    {
      title: t('app_tagline'),
      items: [
        { to: paths.dashboard, label: 'Dashboard', icon: DashboardIcon },
        { to: paths.pos, label: 'POS', icon: PointOfSaleIcon },
        { to: paths.products, label: 'Products', icon: Inventory2Icon },
        { to: paths.customers, label: 'Customers', icon: GroupIcon },
        { to: paths.sales, label: 'Sales', icon: ReceiptLongIcon },
        { to: paths.khata, label: 'Khata', icon: AccountBalanceWalletIcon },
        { to: paths.purchases, label: 'Stock-in', icon: LocalShippingIcon },
        { to: paths.suppliers, label: 'Suppliers', icon: StoreIcon },
        { to: paths.expenses, label: 'Expenses', icon: ReceiptLongIcon },
        { to: paths.targets, label: 'Targets', icon: TrackChangesIcon },
        { to: paths.reports, label: 'Reports', icon: AssessmentIcon }
      ]
    },
    {
      title: 'Settings',
      items: settingsItems
    }
  ]
}
