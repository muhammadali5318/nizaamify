// PermissionsContainer.tsx
import { Box, Divider, Typography } from '@mui/material'
import styles from './PermissionsContainer.module.scss'
import { formatTitle, getTextAfterDelimiter } from 'src/utils/stringUtils'

type PermissionObject = {
  id: string
  name: string
  description?: string
  is_active: boolean
}

type PermissionItem = {
  path: string
  title: string
}

type PermissionsContainerProps = {
  item: PermissionItem
  permissions: PermissionObject[]
}

const PermissionsContainer = ({
  item,
  permissions
}: PermissionsContainerProps) => {
  const permissionCount = permissions.filter((p) => p.is_active).length

  return (
    <Box className={styles.permissionsContainerRoot}>
      {/* Header */}
      <Box className={styles.HeaderContainer}>
        <Box className={styles.IconContainer}>
          <img src={item.path} alt={`${item.title} icon`} />
          <Box>
            <Typography color='#0A0A0A' variant='subtitle1'>
              {formatTitle(item.title)}
            </Typography>
            <Typography
              className={`${styles.permissionCount} ${styles.hidePermissionCountTop}`}
            >
              {permissionCount} Permissions
            </Typography>
          </Box>
        </Box>
        <Typography
          className={`${styles.permissionCount} ${styles.hidePermissionCount}`}
        >
          {permissionCount} Permissions
        </Typography>
      </Box>

      <Divider sx={{ width: '100%', borderColor: 'var(--grey-200)' }} />

      {/* Permission Rows */}
      <Box sx={{ width: '100%' }}>
        {permissions.map((perm, index) => (
          <Box key={perm.id ?? index}>
            <Box className={styles.permissionRow}>
              <Typography variant='body1' color='primary.main'>
                {getTextAfterDelimiter(perm.name)}
              </Typography>

              <Box className={styles.permissionIconContainer}>
                {/* Keep the same icons as before: active -> tick, inactive -> close */}
                <img
                  src={
                    perm.is_active
                      ? '/assets/tick-circle.svg'
                      : '/assets/close-circle.svg'
                  }
                  alt={perm.is_active ? 'active' : 'inactive'}
                />
                <Typography
                  variant='caption'
                  sx={{ display: { xs: 'none', lg: 'inline' } }}
                >
                  {perm.description}
                </Typography>
              </Box>
            </Box>

            {/* Divider between rows except last */}
            {index !== permissions.length - 1 && (
              <Divider sx={{ width: '100%', borderColor: 'var(--grey-200)' }} />
            )}
          </Box>
        ))}

        {/* If there are no permissions for this section, show a small placeholder */}
        {permissions.length === 0 && (
          <Box className={styles.permissionRow} sx={{ py: 2 }}>
            <Typography variant='body2' color='text.secondary'>
              No permissions available
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default PermissionsContainer
