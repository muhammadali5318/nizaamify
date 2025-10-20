import React from 'react'
import { Button, Box, useMediaQuery } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'

type PermissionsEditActionsProps = {
  isEditing: boolean
  onEdit: () => void
  onSave: () => Promise<any>
  onCancel: () => void
  canSave: boolean
}

const PermissionsEditActions: React.FC<PermissionsEditActionsProps> = ({
  isEditing,
  onEdit,
  onSave,
  onCancel,
  canSave
}) => {
  const isMobile = useMediaQuery('(max-width:600px)')

  return (
    <>
      {!isEditing ? (
        <Button
          aria-label='Edit permissions'
          onClick={onEdit}
          size='medium'
          color='primary'
          variant='contained'
          sx={{
            minWidth: isMobile ? 40 : 'auto',
            px: isMobile ? 1 : 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {isMobile ? (
            <EditIcon fontSize='small' sx={{ color: '#fff' }} />
          ) : (
            <>
              <EditIcon fontSize='small' sx={{ color: '#fff', mr: 1 }} />
              Edit
            </>
          )}
        </Button>
      ) : (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            flexDirection: 'row',
            alignSelf: 'stretch',
            gap: 2.5,
            width: isMobile && isEditing ? '100%' : 'auto'
          }}
        >
          <Button
            fullWidth={isMobile && isEditing}
            size='medium'
            variant='outlined'
            onClick={onCancel}
            sx={{
              whiteSpace: 'nowrap'
            }}
          >
            Cancel
          </Button>

          <Button
            fullWidth={isMobile && isEditing}
            size='medium'
            variant='contained'
            onClick={onSave}
            disabled={!canSave}
            sx={{
              whiteSpace: 'nowrap'
            }}
          >
            Save changes
          </Button>
        </Box>
      )}
    </>
  )
}

export default PermissionsEditActions
