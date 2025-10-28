import { Box, Typography, Button } from '@mui/material'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../../store/store'
import { handleFileUpload } from '../../../utils/handleFileUpload'
import uploadIcon from '../../../assets/upload-box-icon.svg'
import fileimage from '../../../assets/upload-file-combined-icon.svg'
import styles from '../documents.module.scss'
import { useState, DragEvent } from 'react'
import ProcessingCompletedList from './ProcessingCompletedList'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
export default function DocumentUploadBox() {
  const dispatch = useDispatch()
  const { files } = useSelector((state: RootState) => state.uploads)
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles && droppedFiles.length > 0) {
      const event = {
        target: { files: droppedFiles }
      } as unknown as React.ChangeEvent<HTMLInputElement>
      handleFileUpload(event, dispatch)
    }
  }
  const { completedFiles } = useSelector((state: RootState) => state.uploads)
  const batches = useSelector((state: RootState) => state.processed.batches)
  console.warn(batches)
  const hasBatches = Object.keys(batches || {}).length > 0

  return (
    <>
      {completedFiles.length > 0 || hasBatches ? (
        <Box sx={{ mt: '20px', width: '100%' }}>
          <ProcessingCompletedList />
        </Box>
      ) : (
        <>
          <Box
            className={`${styles.uploadBox} ${isDragging ? styles.dragActive : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            sx={{
              border: isDragging ? '2px dashed #1976d2' : '2px dashed #ccc',
              borderRadius: '12px',
              padding: '24px',
              transition: 'border 0.2s ease-in-out',
              backgroundColor: isDragging ? '#f0f8ff' : '#fff'
            }}
          >
            {files.length > 0 && (
              <Box
                sx={{
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'space-between'
                }}
              >
                <p> </p>
                <Box
                  mb={1}
                  sx={{
                    backgroundColor: '#FFF4E5',
                    padding: '10px 10px',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: '8px'
                  }}
                >
                  <Box sx={{ color: '#EF6C00' }}>
                    <ErrorOutlineIcon />
                  </Box>
                  <Typography
                    sx={{
                      color: '#663C00',
                      fontWeight: 500,
                      fontSize: 'Medium'
                    }}
                  >
                    {files.length}/5 files uploaded
                  </Typography>
                </Box>
              </Box>
            )}
            <img src={uploadIcon} alt='Upload' width={200} height={100} />
            <Typography variant='h6' mt={1}>
              Upload or drag and drop your financial documents
            </Typography>
            <Typography variant='body2' color='textSecondary' mb={1}>
              You can upload unlimited files but only 5 in one go.
            </Typography>
            <Typography variant='body2' color='textPrimary'>
              Maximum 10MB each — Supported:{' '}
              <strong>.CSV, .PDF, .PNG, .JPG</strong>
            </Typography>

            <img
              style={{ marginTop: '20px' }}
              src={fileimage}
              alt='File types'
              width={200}
              height={30}
            />

            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}
            >
              <Button
                variant='contained'
                component='label'
                disabled={files.length >= 5}
                className={styles.uploadButton}
                sx={{ mt: 2 }}
              >
                {files.length >= 5 ? 'Limit Reached (5/5)' : 'Browse Files'}
                <input
                  hidden
                  type='file'
                  multiple
                  onChange={(e) => handleFileUpload(e, dispatch)}
                />
              </Button>
            </Box>
          </Box>
        </>
      )}
    </>
  )
}
