import React, { useEffect, useState } from 'react'
import { Box, Divider, Typography, Checkbox } from '@mui/material'
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
  isEditing: boolean
  onChange?: (updatedPermissions: PermissionObject[]) => void
}

const PermissionsContainer: React.FC<PermissionsContainerProps> = ({
  item,
  permissions,
  isEditing,
  onChange
}) => {
  const [localPermissions, setLocalPermissions] = useState<PermissionObject[]>(
    permissions || []
  )

  useEffect(() => {
    setLocalPermissions(permissions || [])
  }, [permissions])

  useEffect(() => {
    if (!isEditing) {
      setLocalPermissions(permissions || [])
    }
  }, [isEditing, permissions])

  const permissionCount = localPermissions.filter((p) => p.is_active).length

  const togglePermission = (id: string) => {
    const updated = localPermissions.map((p) =>
      p.id === id ? { ...p, is_active: !p.is_active } : p
    )
    setLocalPermissions(updated)
    if (onChange) onChange(updated)
  }

  return (
    <Box className={styles.permissionsContainerRoot}>
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
        {(localPermissions || []).map((perm, index) => (
          <Box key={perm.id ?? index}>
            <Box className={styles.permissionRow}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {isEditing && (
                  <Checkbox
                    size='small'
                    checked={!!perm.is_active}
                    onChange={() => togglePermission(perm.id)}
                    inputProps={{
                      'aria-label': `${getTextAfterDelimiter(perm.name)} permission`
                    }}
                  />
                )}

                <Typography variant='body1' color='primary.main'>
                  {getTextAfterDelimiter(perm.name)}
                </Typography>
              </Box>

              <Box className={styles.permissionIconContainer}>
                <img
                  src={
                    perm.is_active
                      ? '/assets/tick-circle.svg'
                      : '/assets/close-circle.svg'
                  }
                  alt={perm.is_active ? 'active' : 'inactive'}
                />
              </Box>
            </Box>

            {index !== localPermissions.length - 1 && (
              <Divider sx={{ width: '100%', borderColor: 'var(--grey-200)' }} />
            )}
          </Box>
        ))}

        {localPermissions.length === 0 && (
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
