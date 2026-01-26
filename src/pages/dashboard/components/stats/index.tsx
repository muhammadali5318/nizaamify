import { Box } from '@mui/material'
import StatsCard from './StatsCard'
import styles from './stats.module.scss'
import { useAuth } from 'src/context/AuthProvider'
import { useFetchDashboardStatsForSimpleUserAndManager } from '../../hooks/useFetchDashboardStatsForSimpleUserAndManager'

const Stats = () => {
  const { accessToken } = useAuth()
  const { data } = useFetchDashboardStatsForSimpleUserAndManager(!!accessToken)
  return (
    <Box className={styles.statsRoot}>
      <StatsCard
        title='Uploaded Documents'
        value={data?.practice_documents_count}
        iconSrc='/assets/circle-docs.svg'
        bgColor='rgba(25, 118, 210, 0.08)'
      />
      <StatsCard
        title='Your Uploaded Documents'
        value={data?.user_documents_count}
        bgColor='rgba(46, 125, 50, 0.04)'
        iconSrc='/assets/green-circled-docs.svg'
      />
      <StatsCard
        title='Documents Requiring Review'
        value={data?.practice_documents_review_count}
        bgColor='rgba(239, 108, 0, 0.04)'
        iconSrc='/assets/warning-circled-main.svg'
      />
    </Box>
  )
}

export default Stats
