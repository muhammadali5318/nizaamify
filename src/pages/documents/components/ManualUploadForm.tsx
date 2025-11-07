import React, { useState } from 'react'
import {
  Box,
  Button,
  TextField,
  Typography,
  MenuItem,
  InputLabel,
  Select,
  FormControl,
  Stack,
  SelectChangeEvent,
  Divider
} from '@mui/material'

import FileUploadBox from './DocumentUploadBox'
import ProcessingCompletedList from './ProcessingCompletedList'
import { useSelector } from 'react-redux'
import { RootState } from 'src/store/store'

import {
  getDocumentTypes,
  getDocumentSubtypes,
  category
} from '../../../utils/documentMapping'

import uploadIcon from '../../../assets/upload-box-icon.svg'
import fileimage from '../../../assets/upload-file-combined-icon.svg'
import { notify } from 'src/components/notistack/NotificationProvider'
import manualImg from '../../../../public/assets/manual-upload.svg'
interface ManualEntryFormData {
  entryDate: string
  category: string
  type: string
  subtype: string
  amount: string
  vendorName: string
  invoiceNumber: string
  paymentDate: string
  description: string
  attachments: File[]
}

const ManualEntryForm: React.FC = () => {
  const [formData, setFormData] = useState<ManualEntryFormData>({
    entryDate: '',
    category: '',
    type: '',
    subtype: '',
    amount: '',
    vendorName: '',
    invoiceNumber: '',
    paymentDate: '',
    description: '',
    attachments: []
  })

  const { files, completedFiles } = useSelector(
    (state: RootState) => state.uploads
  )
  const batches = useSelector((state: RootState) => state.processed.batches)
  const hasBatches = Object.keys(batches || {}).length > 0

  const handleFilesSelected = () => {
    console.warn('handleFilesSelected to be implemented')
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    // Prevent selecting a future date for entryDate or paymentDate
    if ((name === 'entryDate' || name === 'paymentDate') && value) {
      const selectedDate = new Date(value)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      if (selectedDate > today) {
        notify.error('Future dates are not allowed.')
        return
      }
    }
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (e: SelectChangeEvent<string>) => {
    const { name, value } = e.target
    if (name) {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        // Reset subtype if type changes
        ...(name === 'type' ? { subtype: '' } : {})
      }))
    }
  }

  const handleSubmit = () => {
    console.warn('Form Data:', formData)
  }

  const types = getDocumentTypes()
  const subtypes = formData.type ? getDocumentSubtypes(formData.type) : []

  return (
    <Box
      sx={{
        p: 2,
        maxWidth: 1100,
        mx: 'auto',
        border: '1px solid #F1F1F1',
        borderRadius: '24px'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          mb: 1,
          gap: 1
        }}
      >
        <img src={manualImg} alt='upload' />
        <Box>
          <Typography variant='h6' fontWeight={600}>
            Add Manual Financial Entry
          </Typography>
          <Typography variant='body2' color='textSecondary'>
            Enter financial transaction details manually. All fields marked with
            * are required.
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ mb: 3 }} />

      <Stack spacing={2}>
        {/* Row 1 */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label='Entry Date *'
            type='date'
            name='entryDate'
            value={formData.entryDate}
            onChange={handleChange}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <FormControl fullWidth>
            <InputLabel>Category *</InputLabel>
            <Select
              name='category'
              value={formData.category}
              label='Category *'
              onChange={handleSelectChange}
            >
              <MenuItem value={category.expense}>Expense</MenuItem>
              <MenuItem value={category.revenue}>Revenue</MenuItem>
              <MenuItem value={category.unknown}>Unknown</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        {/* Row 2 */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormControl fullWidth>
            <InputLabel>Type *</InputLabel>
            <Select
              name='type'
              value={formData.type}
              label='Type *'
              onChange={handleSelectChange}
            >
              {types.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth disabled={!formData.type}>
            <InputLabel>Subtype *</InputLabel>
            <Select
              name='subtype'
              value={formData.subtype}
              label='Subtype *'
              onChange={handleSelectChange}
            >
              {subtypes.map((subtype) => (
                <MenuItem key={subtype} value={subtype}>
                  {subtype}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        {/* Row 3 */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label='Amount (£) *'
            name='amount'
            type='number'
            value={formData.amount}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            label='Vendor/Supplier Name'
            name='vendorName'
            value={formData.vendorName}
            onChange={handleChange}
            fullWidth
          />
        </Stack>

        {/* Row 4 */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label='Invoice Number'
            name='invoiceNumber'
            value={formData.invoiceNumber}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            label='Payment Date'
            type='date'
            name='paymentDate'
            value={formData.paymentDate}
            onChange={handleChange}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>

        {/* Description */}
        <TextField
          label='Description/Notes'
          name='description'
          value={formData.description}
          onChange={handleChange}
          placeholder='Enter any additional notes or description'
          fullWidth
          multiline
          rows={3}
        />

        {/* File Upload */}
        <FileUploadBox
          title='Upload or drag and drop your supporting documents'
          subtitle='You can upload unlimited files but only 5 in one go.'
          fileInfoText='Maximum 10MB each — Supported: .CSV, .PDF, .PNG, .JPG'
          maxFiles={5}
          fileCount={files.length}
          isProcessingComplete={completedFiles.length > 0 && hasBatches}
          completedView={<ProcessingCompletedList />}
          onFilesSelected={handleFilesSelected}
          uploadIcon={uploadIcon}
          fileTypeIcon={fileimage}
        />

        {/* Buttons */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: {
              xs: 'column-reverse',
              sm: 'column-reverse',
              md: 'row',
              lg: 'row'
            },
            gap: 2
          }}
          mt={2}
        >
          <Button variant='outlined'>Cancel</Button>
          <Button
            variant='contained'
            onClick={handleSubmit}
            sx={{
              backgroundColor: '#000',
              '&:hover': { backgroundColor: '#333' }
            }}
          >
            Save Entry
          </Button>
        </Box>
      </Stack>
    </Box>
  )
}

export default ManualEntryForm
