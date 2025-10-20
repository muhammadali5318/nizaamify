/* eslint-disable no-console */
import {
  Avatar,
  Box,
  Button,
  IconButton,
  Tooltip,
  Typography
} from '@mui/material'
import styles from './MemberInfoHeader.module.scss'
import { useLocation, useNavigate, useParams } from 'react-router'
import ImgIcon from 'src/components/common/ImgIcon'
import { FEATURE_RULE_IDS } from 'src/constants/feature-rules'
import { useFeatureRule } from 'src/hooks/useFeatureRule'
import NominatePracticeManagerTeamList from '../../components/NominatePracticeManagerTeamList'
import ConfirmationSuccessDialog from 'src/components/team-management/InvitationSuccessDialog'
import { useEffect, useState } from 'react'
import { paths } from 'src/paths'

const MemberInfoHeader = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { id = '' } = useParams<{
    id: string
  }>()
  const [isNominateOpen, setIsNominateOpen] = useState(false)
  const [successDialogOpen, setSuccessDialogOpen] = useState(false)

  const { name, email, role, isNominated } = location.state || {}

  const { isEnabled: onboardingCompleted } = useFeatureRule(
    FEATURE_RULE_IDS.ONBOARDING_COMPLETED
  )

  useEffect(() => {
    if (successDialogOpen) {
      navigate(paths.teamManagement.gotoSpecificTeamMember(id), {
        state: { name, email, role, isNominated: true }
      })
    }
  }, [successDialogOpen, isNominated, id])

  return (
    <Box className={styles.memberInfoHeaderRoot}>
      <Box className={styles.memberInfoHeaderContainer}>
        <Avatar>
          {name
            ?.split(' ')
            .map((n: any[]) => n[0])
            .join('')
            .toUpperCase()}
        </Avatar>
        <Box>
          <Typography variant='h6' color='text.primary' fontWeight={700}>
            {name}
          </Typography>
          <Typography variant='body1' color='text.secondary'>
            {email}
          </Typography>
        </Box>
      </Box>

      <Box className={styles.memberInfoHeaderContainer}>
        <Button
          size='medium'
          variant='contained'
          color='error'
          startIcon={
            <img src='/assets/person-add-white.svg' alt='person icon' />
          }
        >
          Deactivate user
        </Button>

        <Tooltip placement='top' title='Update member role'>
          <IconButton
            size='small'
            onClick={() => console.log('swap')}
            aria-label='swap member'
          >
            <ImgIcon src='/assets/swap-icon.svg' alt='swap' />
          </IconButton>
        </Tooltip>

        {!onboardingCompleted && role === 'PRACTICE MANAGER' && (
          <Tooltip
            placement='top'
            title={
              isNominated
                ? 'Already nominated'
                : 'Nominate to complete onboarding'
            }
          >
            <IconButton
              size='small'
              aria-label='Nomination flag'
              onClick={() => {
                if (!isNominated) {
                  setIsNominateOpen((prev) => !prev)
                } else {
                  console.log('nominate')
                }
              }}
            >
              <ImgIcon
                src={
                  isNominated
                    ? '/assets/green-flag.svg'
                    : '/assets/blue-flag.svg'
                }
                alt='flag icon'
              />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <NominatePracticeManagerTeamList
        open={isNominateOpen}
        onClose={() => setIsNominateOpen(false)}
        onSuccess={() => setSuccessDialogOpen(true)}
        name={name ?? ''}
        userId={id ?? ''}
      />

      <ConfirmationSuccessDialog
        open={successDialogOpen}
        onClose={() => setSuccessDialogOpen(false)}
        title='Nomination successful!'
      >
        <Typography variant='body2' color='text.secondary'>
          You’ve successfully nominated{' '}
          <Typography component='span' color='text.primary' fontWeight={700}>
            {name}
          </Typography>{' '}
          to complete the practice onboarding process.
        </Typography>

        <Typography variant='body2' color='text.secondary' mt={1}>
          They’ll receive an email notification and now have access to the
          onboarding form.
        </Typography>
      </ConfirmationSuccessDialog>
    </Box>
  )
}

export default MemberInfoHeader
