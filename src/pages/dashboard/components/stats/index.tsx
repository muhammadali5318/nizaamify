import { Box } from '@mui/material'
import StatsCard from './StatsCard'
import styles from './stats.module.scss'

const Stats = () => {
  return (
    <Box className={styles.statsRoot}>
      <StatsCard
        title='Uploaded Documents'
        value={256}
        iconSrc='/assets/circle-docs.svg'
        bgColor='rgba(25, 118, 210, 0.08)'
      />
      <StatsCard
        title='Your Uploaded Documents'
        value={34}
        bgColor='rgba(46, 125, 50, 0.04)'
        iconSrc='/assets/green-circled-docs.svg'
      />
      <StatsCard
        title='Documents Requiring Review'
        value={5}
        bgColor='rgba(239, 108, 0, 0.04)'
        iconSrc='/assets/warning-circled-main.svg'
      />
    </Box>
  )
}

export default Stats
