import { Stack } from '@mui/material'
import MainDashboard from './sections/index'
import DashboardWarningAlertBox from './components/DashboardWarningAlertBox'

const Dashboard = () => {
  return (
    <Stack spacing={2} p={3}>
      <DashboardWarningAlertBox />
      <MainDashboard />
    </Stack>
  )
}

export default Dashboard
