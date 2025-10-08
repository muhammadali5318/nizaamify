import { Box, Stack, Typography } from '@mui/material'
import styles from './TeamManagementContentWrapper.module.scss'

interface TeamManagementContentWrapperProps {
  imageSrc: string
  imageAlt?: string
  title: string
  subtitle: string
  children?: React.ReactNode
}

const TeamManagementContentWrapper: React.FC<
  TeamManagementContentWrapperProps
> = ({
  imageSrc,
  imageAlt = 'content-header-image',
  title,
  subtitle,
  children
}) => {
  return (
    <Box className={styles.teamManagementContentWrapper}>
      <Box className={styles.teamManagementContentHeader}>
        <img src={imageSrc} alt={imageAlt} />
        <Stack>
          <Typography variant='subtitle1' fontWeight={700} color='text.primary'>
            {title}
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            {subtitle}
          </Typography>
        </Stack>
      </Box>
      {/* <Box width='100%' px={2}>
        <Divider
          sx={{
            borderColor: 'var(--grey-200)',
            borderBottomWidth: '2px'
          }}
        />
      </Box> */}

      {children}
    </Box>
  )
}

export default TeamManagementContentWrapper
