import { Box, Typography } from '@mui/material'
import styles from './trainingVideoCard.module.scss'

interface TrainingVideoCardProps {
  title: string
  description: string
  duration?: string
}

const TrainingVideoCard = ({
  title,
  description,
  duration
}: TrainingVideoCardProps) => {
  return (
    <Box className={styles.card}>
      <Box className={styles.thumbnailWrapper}>
        {/* Black background */}
        <Box className={styles.blackBg} />

        {/* Custom play button */}
        <img src='/assets/play.svg' alt='Play' className={styles.playIcon} />

        {duration && (
          <Box className={styles.duration}>
            <img src='/assets/mini-clock.svg' alt='clock icon' />
            {duration}
          </Box>
        )}
      </Box>

      <Box className={styles.content}>
        <Typography variant='body1' fontWeight={700}>
          {title}
        </Typography>
        <Typography variant='body2' color='text.secondary'>
          {description}
        </Typography>
      </Box>
    </Box>
  )
}

export default TrainingVideoCard
