import { Box, Stack, Typography } from '@mui/material'
import styles from './TeamManagementContentWrapper.module.scss'
import InviteTeamMember from './InviteTeamMember'

interface TeamManagementContentWrapperProps {
  imageSrc: string
  imageAlt?: string
  title: string
  subtitle: string
  children?: React.ReactNode
  showInviteTeamMember?: boolean
}

const TeamManagementContentWrapper: React.FC<
  TeamManagementContentWrapperProps
> = ({
  imageSrc,
  imageAlt = 'content-header-image',
  title,
  subtitle,
  children,
  showInviteTeamMember = true
}) => {
  return (
    <Box className={styles.teamManagementContentWrapper}>
      <Box className={styles.teamManagementContentHeader}>
        <Box className={styles.teamManagementContentBody}>
          <img src={imageSrc} alt={imageAlt} />
          <Stack>
            <Typography
              variant='subtitle1'
              fontWeight={700}
              color='text.primary'
            >
              {title}
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              {subtitle}
            </Typography>
          </Stack>
        </Box>
        {showInviteTeamMember && <InviteTeamMember />}
      </Box>

      {children}
    </Box>
  )
}

export default TeamManagementContentWrapper
