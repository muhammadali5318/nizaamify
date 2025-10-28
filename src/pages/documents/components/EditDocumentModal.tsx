import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Typography,
  Box
} from '@mui/material'
import { useDispatch } from 'react-redux'
import { updateDocumentFields } from '../../../store/slices/processedBatchDataSlice'
import { notify } from '../../../components/notistack/NotificationProvider'
import {
  getDocumentTypes,
  getDocumentSubtypes
} from '../../../utils/documentMapping'

interface EditDocumentModalProps {
  open: boolean
  onClose: () => void
  batchId: string
  document: any
}

export default function EditDocumentModal({
  open,
  onClose,
  document
}: EditDocumentModalProps) {
  const dispatch = useDispatch()

  const [formData, setFormData] = useState({
    document_category: '',
    document_type: '',
    document_subtype: '',
    amount: '',
    document_date: '',
    payment_date: ''
  })

  const [availableSubtypes, setAvailableSubtypes] = useState<string[]>([])

  useEffect(() => {
    if (document) {
      setFormData({
        document_category: document.document_category || '',
        document_type: document.document_type || '',
        document_subtype: document.document_subtype || '',
        amount: document.amount || '',
        document_date: document.document_date || '',
        payment_date: document.payment_date || document.document_date || ''
      })
    }
  }, [document])

  useEffect(() => {
    // Whenever document_type changes, update subtypes list
    const subtypes = getDocumentSubtypes(formData.document_type)
    setAvailableSubtypes(subtypes)
  }, [formData.document_type])

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      // reset subtype if type changes
      ...(field === 'document_type' ? { document_subtype: '' } : {})
    }))
  }

  const handleUpdate = () => {
    dispatch(
      updateDocumentFields({
        document_id: document.document_id,
        updates: formData
      })
    )
    onClose()
    notify.success('Data updated successfully!')
  }

  if (!document) return null

  const documentTypes = getDocumentTypes()

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth='sm'>
      <DialogTitle>Change document information</DialogTitle>
      <DialogContent dividers>
        <Typography variant='subtitle1' mb={2}>
          Select the correct category for <b>{document.file_name}</b> doc from
          the list below.
        </Typography>

        <Box display='flex' flexDirection='column' gap={2}>
          {/* Document Type */}
          <TextField
            select
            fullWidth
            label='Document type'
            value={formData.document_type}
            onChange={(e) => handleChange('document_type', e.target.value)}
          >
            {documentTypes.map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </TextField>

          {/* Document Subtype */}
          <TextField
            select
            fullWidth
            label='Document subtype'
            value={formData.document_subtype}
            onChange={(e) => handleChange('document_subtype', e.target.value)}
            disabled={!formData.document_type}
          >
            {availableSubtypes.map((sub) => (
              <MenuItem key={sub} value={sub}>
                {sub}
              </MenuItem>
            ))}
          </TextField>

          {/* Amount */}
          <TextField
            fullWidth
            label='Extracted amount'
            type='number'
            value={formData.amount}
            onChange={(e) => handleChange('amount', e.target.value)}
          />

          {/* Dates */}
          <Box display='flex' gap={2}>
            <TextField
              fullWidth
              label='Date on document'
              type='date'
              slotProps={{ inputLabel: { shrink: true } }}
              value={formData.document_date}
              onChange={(e) => handleChange('document_date', e.target.value)}
            />

            <TextField
              fullWidth
              label='Payment date'
              type='date'
              slotProps={{ inputLabel: { shrink: true } }}
              value={formData.payment_date}
              onChange={(e) => handleChange('payment_date', e.target.value)}
            />
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant='outlined' color='inherit'>
          Cancel
        </Button>
        <Button onClick={handleUpdate} variant='contained' color='primary'>
          Update changes
        </Button>
      </DialogActions>
    </Dialog>
  )
}
