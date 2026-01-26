import { Box, Typography, Button } from '@mui/material'

export interface ReasonForArchivingStepProps {
  onBack: () => void
  onArchive: () => void
}

export function ReasonForArchivingStep({
  onBack,
  onArchive
}: ReasonForArchivingStepProps) {
  const handleArchiveClick = () => {
    onArchive()
  }

  return (
    <Box>
      <Typography variant='body1' sx={{ mb: 1 }}>
        Tell us why you&apos;re archiving this practice (this helps us improve).
      </Typography>

      <Box display={'flex'} gap={1.2}>
        <Button fullWidth variant='outlined' onClick={onBack}>
          Back
        </Button>

        <Button
          fullWidth
          color='error'
          variant='contained'
          onClick={handleArchiveClick}
        >
          Archive practice
        </Button>
      </Box>
    </Box>
  )
}
