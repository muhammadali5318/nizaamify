import { Stack } from '@mui/material'
import MainDashboard from './sections/index'
import DashboardWarningAlertBox from './components/DashboardWarningAlertBox'
import { useCheckBankConnectionHealth } from 'src/hooks/useCheckBankConnectionHealth'
import { useAuth } from 'src/context/AuthProvider'
import dayjs from 'dayjs'

const Dashboard = () => {
  const { accessToken } = useAuth()
  const { data } = useCheckBankConnectionHealth(!!accessToken)
  const daysLeft = data?.days_left
  return (
    <Stack spacing={2} p={3}>
      <DashboardWarningAlertBox title='Needs attention' />
      {daysLeft !== undefined && daysLeft <= 15 && daysLeft > 0 && (
        <DashboardWarningAlertBox
          title={`Your bank connection consent will expire in ${daysLeft} days (on ${dayjs(
            data?.reconfirm_by
          ).format('DD MMM YYYY')}).`}
          renderDetail='bankAlert'
        />
      )}

      <MainDashboard />
    </Stack>
  )
}

export default Dashboard
