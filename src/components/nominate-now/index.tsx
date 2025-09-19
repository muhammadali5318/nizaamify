import { Box, Typography, Button } from '@mui/material'
import styles from './NominateNowContainer.module.scss'

type NominateNowContainerProps = {
  onSelectNominee: () => void
}

const NominateNowContainer: React.FC<NominateNowContainerProps> = ({
  onSelectNominee
}) => {
  return (
    <Box className={styles.nominateNowContainer}>
      <Box>
        <Typography
          color='var(--_components-alert-info-color)'
          variant='subtitle1'
          className='font-weight--700'
        >
          Having trouble?
        </Typography>
        <Typography
          color='var(--_components-alert-info-color)'
          variant='caption'
        >
          You can nominate your practice manager to complete the onboarding on
          your behalf.
        </Typography>
      </Box>
      <Button
        variant='outlined'
        fullWidth
        size='small'
        onClick={onSelectNominee}
        sx={{
          border: '1px solid var(--primary-_states-outlinedBorder)',
          color: 'var(--_components-alert-info-color)'
        }}
      >
        Nominate now
      </Button>
    </Box>
  )
}

export default NominateNowContainer
