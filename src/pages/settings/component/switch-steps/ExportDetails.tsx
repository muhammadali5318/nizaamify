import { Box, Stack, Typography } from '@mui/material'
import styles from './switchSteps.module.scss'

interface ExportDetailsProps {
  icon?: string
  label: string
  value?: string
}

const ExportDetails: React.FC<ExportDetailsProps> = ({
  icon = '/assets/income-icon.svg',
  label,
  value
}) => {
  return (
    <Box className={styles.exportDetailsRoot}>
      {icon && <img src={icon} alt={`${label} icon`} />}

      <Stack spacing={0.5}>
        <Typography variant='subtitle2' color='text.secondary'>
          {label}
        </Typography>

        <Typography variant='body1' fontWeight={700}>
          {value}
        </Typography>
      </Stack>
    </Box>
  )
}

export default ExportDetails
