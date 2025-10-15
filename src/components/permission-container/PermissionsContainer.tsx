import { Box, Divider, Typography } from '@mui/material'
import styles from './PermissionsContainer.module.scss'

type PermissionItem = {
  path: string
  title: string
}

type PermissionsContainerProps = {
  item: PermissionItem
}

const PermissionsContainer = ({ item }: PermissionsContainerProps) => {
  const permissionRows = [
    {
      label: 'View revenue dashboard',
      icon: '/assets/close-circle.svg',
      note: '(Per practice only if support required)'
    },
    {
      label: 'View revenue dashboard',
      icon: '/assets/tick-circle.svg',
      note: '(Per practice only if support required)'
    },
    {
      label: 'View revenue dashboard',
      icon: '/assets/tick-circle.svg',
      note: '(Per practice only if support required)'
    }
  ]

  return (
    <Box className={styles.permissionsContainerRoot}>
      {/* Header */}
      <Box className={styles.HeaderContainer}>
        <Box className={styles.IconContainer}>
          <img src={item.path} alt={`${item.title} icon`} />
          <Box>
            <Typography color='#0A0A0A' variant='subtitle1'>
              {item.title}
            </Typography>
            <Typography
              className={`${styles.permissionCount} ${styles.hidePermissionCountTop}`}
            >
              {permissionRows.length} Permissions
            </Typography>
          </Box>
        </Box>
        <Typography
          className={`${styles.permissionCount} ${styles.hidePermissionCount}`}
        >
          {permissionRows.length} Permissions
        </Typography>
      </Box>

      <Divider sx={{ width: '100%', borderColor: 'var(--grey-200)' }} />

      {/* Permission Rows */}
      <Box sx={{ width: '100%' }}>
        {permissionRows.map((row, index) => (
          <Box key={index}>
            <Box className={styles.permissionRow}>
              <Typography variant='body1' color='primary.main'>
                {row.label}
              </Typography>
              <Box className={styles.permissionIconContainer}>
                <img src={row.icon} alt='permission icon' />
                <Typography
                  variant='caption'
                  sx={{
                    display: { xs: 'none', lg: 'inline' }
                  }}
                >
                  {row.note}
                </Typography>
              </Box>
            </Box>

            {/* Divider between rows except last */}
            {index !== permissionRows.length - 1 && (
              <Divider sx={{ width: '100%', borderColor: 'var(--grey-200)' }} />
            )}
          </Box>
        ))}
      </Box>
    </Box>
  )
}

export default PermissionsContainer
