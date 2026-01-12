import { Box, Typography } from '@mui/material'
import styles from './stats.module.scss'

export interface StatsCardProps {
  title?: string
  value?: number | string
  iconSrc?: string
  iconAlt?: string
  bgColor?: string
}

const StatsCard: React.FC<StatsCardProps> = ({
  title = 'Total Practice Documents',
  value = 122,
  iconSrc = '/assets/circle-docs.svg',
  iconAlt = 'stats icon',
  bgColor = 'rgba(2, 136, 209, 0.04)'
}) => {
  return (
    <Box
      className={styles.statsCardRoot}
      sx={{
        backgroundColor: bgColor
      }}
    >
      <Box className={styles.left}>
        <img src={iconSrc} alt={iconAlt} />
        <Typography variant='subtitle1' fontWeight={700}>
          {title}
        </Typography>
      </Box>

      <Typography variant='h4' fontWeight={700}>
        {value}
      </Typography>
    </Box>
  )
}

export default StatsCard
