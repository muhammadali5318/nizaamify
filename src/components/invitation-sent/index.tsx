import { Stack, Box, Button, Typography, Divider } from '@mui/material'
import styles from './invitationSent.module.scss'
import RenderUlList from '../render-ul-list'
import { paths } from 'src/paths'
import { useNavigate, useSearchParams } from 'react-router'

type InvitationSentProps = {
  practiceName: string
}

const InvitationSent = ({ practiceName }: InvitationSentProps) => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const email = searchParams.get('email') || ''
  const role = searchParams.get('role') || ''

  return (
    <Stack className={styles.invitationSentRoot}>
      <Box>
        <img
          className='icon-dimension--88'
          src='/assets/verified.svg'
          alt='verified icon'
        />
      </Box>
      <Stack spacing={1}>
        <Typography variant='h4' className='font-weight--700'>
          Invitation sent successfully!
        </Typography>
        <Typography color='var(--color-text-secondary)' variant='subtitle1'>
          An invitation has been sent to{' '}
          <span className={styles.invitationTypography}>{email}</span> to join{' '}
          <span className={styles.invitationTypography}>{practiceName}</span> as
          a <span className={styles.invitationTypography}>{role}.</span>
        </Typography>
        <Typography color='var(--color-text-secondary)' variant='subtitle1'>
          They’ll receive an email with instructions to set up their account.
        </Typography>
        <Divider />
        <Typography
          variant='h6'
          color='var(--color-text-primary)'
          className='font-weight--700'
        >
          What happens next:
        </Typography>
        <RenderUlList
          items={[
            'Your practice manager will receive the invitation email.',
            'They’ll create their account and complete the practice setup.',
            'You retain full administrative access as the practice owner.',
            'You can monitor progress or step in at any time.'
          ]}
        />

        <Divider />
      </Stack>
      <Box className={styles.actions}>
        <Button
          fullWidth
          variant='outlined'
          aria-label='cancel'
          onClick={() => navigate(paths.dashboard)}
        >
          Go to dashboard
        </Button>
        <Button
          fullWidth
          variant='contained'
          type='submit'
          aria-label='send-invitation'
          onClick={() => navigate(paths.practiceOnboardingStepper)}
        >
          Continue onboarding myself
        </Button>
      </Box>
    </Stack>
  )
}

export default InvitationSent
