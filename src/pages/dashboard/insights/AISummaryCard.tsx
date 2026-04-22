import { Typography, Box, Stack } from '@mui/material'
import styles from './summaryCard.module.scss'
import aiIcon from '../../../assets/ai-summary-icon.svg'

interface InsightItem {
  insight: string
  suggestion: string
}

interface AISummaryCardProps {
  aiInsight: InsightItem[]
}

const AISummaryCard = ({ aiInsight }: AISummaryCardProps) => (
  <Stack spacing={1.2} className={styles.cardContainer}>
    <Box className={styles.insightContainer}>
      <img src={aiIcon} alt='AI Summary' />
      <Typography variant='h6' fontWeight={500}>
        AI Summary
      </Typography>
    </Box>

    {aiInsight?.map((item, index) => (
      <Box key={index} className={styles.insightContainer}>
        <img src={'/assets/sparkles.svg'} alt='sparkles' />
        <Typography variant='subtitle1'>{item.insight}</Typography>
      </Box>
    ))}
  </Stack>
)

export default AISummaryCard
