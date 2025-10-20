// src/components/permission-container/PermissionsEditActions.tsx
import React from 'react'
import { Button, Box } from '@mui/material'
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
  return (
    <>
      {!isEditing ? (
        <Button
          aria-label='Edit permissions'
          onClick={onEdit}
          size='medium'
          color='primary'
          variant='contained'
          startIcon={<EditIcon fontSize='small' />}
        >
          Edit
        </Button>
      ) : (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            flexDirection: 'row',
            gap: 2.5,
            width: 'auto'
          }}
        >
          <Button
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
