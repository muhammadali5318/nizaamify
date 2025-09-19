import { Alert, Box, Stack, Typography } from '@mui/material'
import { useNavigate } from 'react-router'
import styles from './ChooseOnboardingFlow.module.scss'
import ChooseNominationCard from 'src/components/choose-nomination-card'
import { paths } from 'src/paths'
import NominatePracticeManagerDialog from 'src/components/nomiate-practice-manage'
import React from 'react'

type ChooseOnboardingFlowProps = {
  onContinue: () => void
}

const ChooseOnboardingFlow: React.FC<ChooseOnboardingFlowProps> = ({
  onContinue
}) => {
  const navigate = useNavigate()
  const [openNominate, setOpenNominate] = React.useState(false)

  const handleSend = (payload: { email: string; role: string }) => {
    // call your API to send invite
    // eslint-disable-next-line no-console
    console.log('send invite', payload)
    onContinue()
  }

  return (
    <Stack
      spacing={2.5}
      px={4}
      py={2}
      className={styles.chooseOnboardingFlowRoot}
    >
      <Box>
        <img
          src='/assets/onboardin-practice.svg'
          alt='onboardin-practice icon'
        />
      </Box>

      <Stack spacing={0.5}>
        <Typography
          textAlign='center'
          variant='h5'
          className='font-weight--700'
        >
          Choose your onboarding path
        </Typography>
        <Typography
          variant='subtitle1'
          color='var(--color-text-primary)'
          textAlign='center'
          px={3.5}
        >
          You can either complete the onboarding process yourself now, or
          nominate your practice manager to handle this step.
        </Typography>
      </Stack>

      <Stack spacing={1.5} width='100%'>
        <ChooseNominationCard
          heading='Complete onboarding now'
          description='Set up the practice yourself (5–7 mins: data, preferences, setup).'
          imagePath='/assets/complete-onboarding.svg'
          alt='complete-onboarding'
          onClick={() => navigate(`${paths.practiceOnboardingStepper}?step=1`)}
        />
        <ChooseNominationCard
          heading='Nominate practice manager'
          description='Invite your practice manager to complete the onboarding on your behalf.'
          imagePath='/assets/nominate.svg'
          alt='nominate'
          onClick={() => setOpenNominate(true)}
        />
      </Stack>

      <Alert severity='info'>
        <Typography
          className='alert-info-text'
          component='div'
          sx={{ margin: 0 }}
        >
          Complete your practice onboarding to unlock the full Monai experience
          or nominate your Practice Manager to get started right away
        </Typography>
      </Alert>
      <NominatePracticeManagerDialog
        open={openNominate}
        onClose={() => setOpenNominate(false)}
        onSend={handleSend}
      />
    </Stack>
  )
}

export default ChooseOnboardingFlow
