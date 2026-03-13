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
  Divider,
  IconButton
} from '@mui/material'

import FileUploadBox from './DocumentUploadBox'
import ProcessingCompletedList from './ProcessingCompletedList'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from 'src/store/store'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs from 'dayjs'
import {
  getDocumentSubtypes,
  category,
  getFilteredDocumentTypes,
  getExpenseSubcategories
} from '../../../utils/documentMapping'
import {
  addFilesToQueue,
  removeFileFromQueue
} from 'src/store/slices/manualEntryQueueSlice'

import uploadIcon from '../../../assets/upload-box-icon.svg'
import fileimage from '../../../assets/upload-file-combined-icon.svg'
import { notify } from 'src/components/notistack/NotificationProvider'
import manualImg from '../../../../public/assets/manual-upload.svg'
import { handleConfirmUploadUtil } from 'src/services/apis/uploadToS3'
import { useAuth0 } from '@auth0/auth0-react'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { createManualEntry } from 'src/services/apis/manualEntryApi'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import { getFileIcon } from 'src/utils/getFileIcon'
import { useNavigate } from 'react-router'
import { resetPresignResponse } from 'src/store/slices/manualEntryFilesSlice'
interface ManualEntryFormData {
  entryDate: dayjs.Dayjs | null
  paymentDate: dayjs.Dayjs | null
  category: string
  type: string
  subtype: string
  amount: string
  vendorName: string
  invoiceNumber: string
  description: string
  lineItem: string

  attachments: File[]
}

const ManualEntryForm: React.FC = () => {
  const [formData, setFormData] = useState<ManualEntryFormData>({
    entryDate: dayjs(),
    paymentDate: null,
    category: '',
    type: '',
    subtype: '',
    amount: '',
    lineItem: '',
    vendorName: '',
    invoiceNumber: '',
    description: '',
    attachments: []
  })
  const { completedFiles } = useSelector((state: RootState) => state.uploads)
  const [isSaving, setIsSaving] = useState(false)
  const batches = useSelector((state: RootState) => state.processed.batches)
  const hasBatches = Object.keys(batches || {}).length > 0
  const dispatch = useDispatch()
  const queue = useSelector((state: RootState) => state.manualEntryQueue.queue)
  const { user } = useAuth0()
  const { activePracticeId } = useActivePractice()
  const types = getFilteredDocumentTypes(formData.category)
  const subtypes = formData.type ? getDocumentSubtypes(formData.type) : []
  const MAX_FILES = 5

  const handleFilesSelected = (incomingFiles: FileList | File[]) => {
    const newFiles = Array.from(incomingFiles)
    const uploadedCount = manualEntryFiles.items.length
    const queuedCount = queue.length
    const totalCount = uploadedCount + queuedCount

    const availableSlots = MAX_FILES - totalCount

    if (availableSlots <= 0) {
      notify.error(`You already have ${MAX_FILES} files uploaded.`)
      return
    }

    if (newFiles.length > availableSlots) {
      notify.error(
        `You can only upload ${availableSlots} more file(s). All selected files were discarded.`
      )
      return
    }

    dispatch(addFilesToQueue(newFiles))
  }

  const navigate = useNavigate()
  const [amountError, setAmountError] = useState<string>('')
  const userId = user?.user_data?.user_metadata?.uuid
  const manualEntryFiles = useSelector(
    (state: RootState) => state.manualEntryFiles
  )
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    if ((name === 'entryDate' || name === 'paymentDate') && value) {
      const selectedDate = new Date(value)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      if (selectedDate > today) {
        notify.error('Future dates are not allowed.')
        return
      }
    }
    if (name === 'amount') {
      const numberValue = parseFloat(value)

      if (value !== '' && numberValue < 0) {
        setAmountError('Amount cannot be negative')
        notify.error(amountError || 'Amount cannot be negative')
      } else {
        setAmountError('')
      }
    }

    if (name === 'amount' && value !== '' && parseFloat(value) < 0) {
      return
    }
    if (name === 'vendorName' || name === 'invoiceNumber') {
      if (value.length > 255) {
        notify.error(
          `${name === 'vendorName' ? 'Vendor Name' : 'Invoice Number'} cannot exceed 255 characters`
        )
        return
      }
    }

    setFormData((prev) => ({ ...prev, [name]: value }))
  }
  const lineItems =
    formData.type && formData.subtype
      ? getExpenseSubcategories(formData.type, formData.subtype)
      : []

  const handleSelectChange = (e: SelectChangeEvent<string>) => {
    const { name, value } = e.target

    if (!name) return

    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'category' ? { type: '', subtype: '', lineItem: '' } : {}),
      ...(name === 'type' ? { subtype: '', lineItem: '' } : {}),
      ...(name === 'subtype' ? { lineItem: '' } : {})
    }))
  }

  const handleConfirmUpload = () => {
    handleConfirmUploadUtil({
      queue,
      userId,
      dispatch,
      org_id: activePracticeId || ''
    })
  }

  const handleCancel = () => {
    navigate('/documents')
    dispatch(resetPresignResponse())
  }
  const handleSubmit = async () => {
    if (isSaving) return

    try {
      setIsSaving(true)

      if (!activePracticeId) {
        notify.error('Practice ID missing')
        return
      }

      // Map uploaded files
      const presignedFiles = manualEntryFiles.items

      const fileObj = presignedFiles?.map((p: any) => ({
        file_size: p.size?.toString() || '0',
        file_type: p.filename.split('.').pop() || '',
        file_name: p.filename || '',
        file_obj_key: p.key
      }))

      const payload = {
        entry_date: formData.entryDate
          ? formData.entryDate.format('DD/MM/YYYY')
          : null,

        category: formData.category,
        type: formData.type,
        subtype: formData.subtype,
        amount: formData.amount,
        vendor_supplier_name: formData.vendorName,
        invoice_number: formData.invoiceNumber,
        description: formData.description,
        line_item: formData.lineItem,
        payment_date: formData.paymentDate
          ? formData.paymentDate.format('DD/MM/YYYY')
          : null,
        file_obj: fileObj
      }

      const res = await createManualEntry({
        practiceId: activePracticeId,
        payload
      })

      notify.success(res.message || 'Manual entry saved successfully')
      navigate('/documents')
      setFormData({
        entryDate: dayjs(),
        category: '',
        type: '',
        subtype: '',
        amount: '',
        lineItem: '',
        vendorName: '',
        invoiceNumber: '',
        paymentDate: null,
        description: '',
        attachments: []
      })
      dispatch({ type: 'manualEntryQueue/clearQueue' })

      dispatch({ type: 'manualEntryFiles/clearFiles' })
      dispatch(resetPresignResponse())

      dispatch({ type: 'processed/clearBatches' })
    } catch (err: any) {
      console.error(err)

      const backendErrors = err?.error

      const { parseApiErrors } = await import('src/utils/parseApiErrors')
      const messages = parseApiErrors(backendErrors)
      if (messages.length > 0) {
        notify.error(messages.join('\n'))
      } else {
        if (err?.message) {
          notify.error(err?.message)
          return
        }
        notify.error(err?.response?.data?.message || 'Failed to save entry')
      }
    } finally {
      setIsSaving(false)
    }
  }

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
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              format='DD/MM/YYYY'
              label='Entry Date *'
              disableFuture
              value={formData.entryDate}
              onChange={(v) => setFormData((p) => ({ ...p, entryDate: v }))}
              slotProps={{
                textField: { fullWidth: true }
              }}
              sx={{
                '& .MuiPickersInputBase-root': {
                  borderRadius: '12px'
                }
              }}
            />
          </LocalizationProvider>
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
            <InputLabel>Document category *</InputLabel>
            <Select
              name='type'
              value={formData.type}
              label='Document category *'
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
            <InputLabel>Document subcategory *</InputLabel>
            <Select
              name='subtype'
              value={formData.subtype}
              label='Document subcategory *'
              onChange={handleSelectChange}
            >
              {subtypes.map((subtype) => (
                <MenuItem key={subtype} value={subtype}>
                  {subtype}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {formData.type !== 'Income & Revenue' && (
            <FormControl fullWidth disabled={!formData.subtype}>
              <InputLabel>Line Item *</InputLabel>
              <Select
                name='lineItem'
                value={formData.lineItem}
                label='Line Item *'
                onChange={handleSelectChange}
              >
                {lineItems.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
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
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              format='DD/MM/YYYY'
              label='Payment Date'
              disableFuture
              value={formData.paymentDate}
              onChange={(v) => setFormData((p) => ({ ...p, paymentDate: v }))}
              slotProps={{
                textField: { fullWidth: true }
              }}
              sx={{
                '& .MuiPickersInputBase-root': {
                  borderRadius: '12px'
                }
              }}
            />
          </LocalizationProvider>
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
          fileInfoText='Maximum 10MB each — Supported: .CSV, .PDF, .PNG, .JPG, .DOC'
          maxFiles={5}
          fileCount={manualEntryFiles.items.length + queue.length}
          isProcessingComplete={completedFiles.length > 0 && hasBatches}
          completedView={<ProcessingCompletedList />}
          onFilesSelected={handleFilesSelected}
          uploadIcon={uploadIcon}
          fileTypeIcon={fileimage}
        />
        {/* QUEUE SECTION */}
        {queue.length > 0 && (
          <Box mt={3}>
            <Box
              mb={2}
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between',
                alignItems: 'baseline'
              }}
            >
              <Typography sx={{ fontWeight: '700' }} mb={1}>
                Upload queue ({queue.length})
              </Typography>

              {queue.length > 0 && (
                <Button
                  variant='contained'
                  sx={{ background: '#000' }}
                  onClick={handleConfirmUpload}
                >
                  Confirm Upload ({queue.length})
                </Button>
              )}
            </Box>

            {/* List Queued Files */}
            {queue.map((item) => (
              <Box
                key={item.id}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  p: 1.5,
                  mb: 1,
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px'
                }}
              >
                <Box
                  display='flex'
                  justifyContent='space-between'
                  alignItems='center'
                >
                  {/* LEFT SIDE - FILE ICON + DETAILS */}
                  <Box display='flex' alignItems='center' gap={1.2}>
                    <img
                      src={getFileIcon(item.file.name)}
                      alt='file-icon'
                      width={28}
                      height={28}
                    />

                    <Box textAlign='left'>
                      <Typography variant='body2'>{item.file.name}</Typography>

                      <Typography variant='caption' color='textSecondary'>
                        {(item.file.size / 1024).toFixed(2)} KB —{' '}
                        {item.file.type || 'Unknown'}
                      </Typography>
                    </Box>
                  </Box>

                  {/* RIGHT SIDE - REMOVE BUTTON */}
                  <IconButton
                    onClick={() => dispatch(removeFileFromQueue(item.id))}
                    size='small'
                    color='error'
                  >
                    <CancelOutlinedIcon />
                  </IconButton>
                </Box>
              </Box>
            ))}
          </Box>
        )}
        <Box>
          {manualEntryFiles.items.length > 0 && (
            <Box mt={3}>
              <Typography variant='h6'>
                Successfully Uploaded ({manualEntryFiles.items.length})
              </Typography>

              {manualEntryFiles.items.map((file: any, index: number) => (
                <Box
                  key={index}
                  sx={{
                    p: 1.5,
                    mb: 1,
                    background: '#E8F5E9',
                    borderRadius: '8px',
                    border: '1px solid #C8E6C9'
                  }}
                >
                  <Stack direction='row' spacing={1.5} alignItems='center'>
                    <img
                      alt='file'
                      src={getFileIcon(file.filename)}
                      width={28}
                    />

                    <div>
                      <Typography>{file.filename}</Typography>
                      <Typography variant='caption'>
                        {file.headers['Content-Type']}
                      </Typography>
                    </div>
                  </Stack>
                </Box>
              ))}
            </Box>
          )}
        </Box>
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
          <Button variant='outlined' onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant='contained'
            onClick={handleSubmit}
            disabled={isSaving}
            sx={{
              backgroundColor: '#000',
              '&:hover': { backgroundColor: '#333' }
            }}
          >
            {isSaving ? 'Saving...' : 'Save Entry'}
          </Button>
        </Box>
      </Stack>
    </Box>
  )
}

export default ManualEntryForm
