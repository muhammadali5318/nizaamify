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
  SelectChangeEvent
} from '@mui/material'

import FileUploadBox from './DocumentUploadBox'
import ProcessingCompletedList from './ProcessingCompletedList'

import { useSelector } from 'react-redux'
import { RootState } from 'src/store/store'
import uploadIcon from '../../../assets/upload-box-icon.svg'
import fileimage from '../../../assets/upload-file-combined-icon.svg'
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

// const UploadBox = styled(Box)(({ theme }) => ({
//   border: '1px dashed #D0D5DD',
//   borderRadius: 12,
//   padding: theme.spacing(4),
//   textAlign: 'center',
//   backgroundColor: '#FCFCFD',
//   color: '#344054'
// }))

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
  //  const navigate = useNavigate()
  //   const dispatch = useDispatch()
  const { files, completedFiles } = useSelector(
    (state: RootState) => state.uploads
  )
  const batches = useSelector((state: RootState) => state.processed.batches)
  const hasBatches = Object.keys(batches || {}).length > 0

  const handleFilesSelected = () => {
    // const event = {
    //   target: { files: selectedFiles }
    // } as unknown as React.ChangeEvent<HTMLInputElement>
    // handleFileUpload(event, dispatch, files.length)
    console.warn('handleFilesSelected to be implemented')
  }
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (e: SelectChangeEvent<string>) => {
    const { name, value } = e.target
    if (name) {
      setFormData((prev) => ({ ...prev, [name]: value }))
    }
  }

  //   const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  //     if (e.target.files) {
  //       const files = Array.from(e.target.files)
  //       setFormData((prev) => ({
  //         ...prev,
  //         attachments: [...prev.attachments, ...files]
  //       }))
  //     }
  //   }

  //   const handleRemoveFile = (index: number) => {
  //     setFormData((prev) => ({
  //       ...prev,
  //       attachments: prev.attachments.filter((_, i) => i !== index)
  //     }))
  //   }

  const handleSubmit = () => {
    console.log('Form Data:', formData)
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: 'auto' }}>
      <Typography variant='h6' fontWeight={600} mb={3}>
        Add Manual Financial Entry
      </Typography>

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
              <MenuItem value='Cost/expense'>Cost/expense</MenuItem>
              <MenuItem value='Income'>Income</MenuItem>
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
              <MenuItem value='Staff Costs'>Staff Costs</MenuItem>
              <MenuItem value='Office Supplies'>Office Supplies</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Subtype *</InputLabel>
            <Select
              name='subtype'
              value={formData.subtype}
              label='Subtype *'
              onChange={handleSelectChange}
            >
              <MenuItem value='Associates Fees'>Associates Fees</MenuItem>
              <MenuItem value='Travel Expenses'>Travel Expenses</MenuItem>
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

        {/* Attachments */}
        {/* <Box>
          <Typography fontWeight={500} mb={1}>
            Attachments
          </Typography>
          <UploadBox>
            <CloudUploadIcon sx={{ fontSize: 48, mb: 1 }} />
            <Typography fontWeight={600}>
              Upload supporting documents (optional)
            </Typography>
            <Typography variant='body2' color='text.secondary' mb={2}>
              Maximum File Size is 10MB. Supported File Types are: .CSV, .PDF,
              .PNG, .JPG
            </Typography>
            <Button
              variant='outlined'
              component='label'
              startIcon={<CloudUploadIcon />}
            >
              Browse files
              <input
                hidden
                type='file'
                multiple
                accept='.csv,.pdf,.png,.jpg,.jpeg'
                onChange={handleFileUpload}
              />
            </Button>

            {formData.attachments.length > 0 && (
              <Stack mt={2} spacing={1}>
                {formData.attachments.map((file, index) => (
                  <Paper
                    key={index}
                    sx={{
                      p: 1,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    variant='outlined'
                  >
                    <Typography variant='body2'>{file.name}</Typography>
                    <IconButton
                      size='small'
                      onClick={() => handleRemoveFile(index)}
                    >
                      <DeleteOutlineIcon fontSize='small' />
                    </IconButton>
                  </Paper>
                ))}
              </Stack>
            )}
          </UploadBox>
        </Box> */}
        <FileUploadBox
          title='Upload or drag and drop your financial documents'
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
        <Stack direction='row' justifyContent='flex-end' spacing={2} mt={2}>
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
        </Stack>
      </Stack>
    </Box>
  )
}

export default ManualEntryForm
