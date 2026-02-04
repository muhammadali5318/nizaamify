import { Stack } from '@mui/material'
import MainDashboard from './sections/index'
import DashboardWarningAlertBox from './components/DashboardWarningAlertBox'
// import { useCheckBankConnectionHealth } from 'src/hooks/useCheckBankConnectionHealth'
import useUserDetails from 'src/hooks/useUserDetails'
import SubmitFeedback from './components/submit-feedback'
import Stats from './components/stats'
import Welcome from './components/welcome'

const Dashboard = () => {
  const { isUserManageOrSimpleUser, isUserOwnerOrDirector } = useUserDetails()

  // const { data } = useCheckBankConnectionHealth(shouldFetch)
  return (
    <Stack spacing={2} p={{ xs: 1.5, sm: 2, md: 3 }}>
      <DashboardWarningAlertBox title='Needs attention' />
      {/* {daysLeft !== undefined && daysLeft <= 15 && daysLeft > 0 && (
        <DashboardWarningAlertBox
          title={`Your bank connection consent will expire in ${daysLeft} days (on ${dayjs(
            data?.reconfirm_by
          ).format('DD MMM YYYY')}).`}
          renderDetail='bankAlert'
        />
      )} */}

      {isUserOwnerOrDirector && <MainDashboard />}
      {isUserManageOrSimpleUser && <Welcome />}
      {isUserManageOrSimpleUser && <Stats />}
      <SubmitFeedback />
    </Stack>
  )
}

export default Dashboard
