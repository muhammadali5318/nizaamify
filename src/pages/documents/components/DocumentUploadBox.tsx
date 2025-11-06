import React, { useState, DragEvent } from 'react'
import { Box, Typography, Button } from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import styles from '../documents.module.scss'

interface FileUploadBoxProps {
  /** Custom heading shown in the upload box */
  title?: string
  /** Subtext under title */
  subtitle?: string
  /** Supported file types message */
  fileInfoText?: string
  /** Max number of files that can be uploaded at once */
  maxFiles?: number
  /** Called when files are selected or dropped */
  onFilesSelected: (files: FileList) => void
  /** Optional: Current uploaded file count */
  fileCount?: number
  /** Optional: Total completed file count */
  completedCount?: number
  /** Optional: Whether processing is complete (to render custom children) */
  isProcessingComplete?: boolean
  /** Optional: What to render when processing is done */
  completedView?: React.ReactNode
  /** Optional: Custom icons or illustrations */
  uploadIcon?: string
  fileTypeIcon?: string
  /** Disable upload completely */
  disabled?: boolean
}

const FileUploadBox: React.FC<FileUploadBoxProps> = ({
  title = 'Upload or drag and drop your files',
  subtitle = 'You can upload unlimited files but only a few in one go.',
  fileInfoText = 'Maximum 10MB each — Supported: .CSV, .PDF, .PNG, .JPG',
  maxFiles = 5,
  onFilesSelected,
  fileCount = 0,

  isProcessingComplete = false,
  completedView,
  uploadIcon,
  fileTypeIcon,
  disabled = false
}) => {
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
      onFilesSelected(droppedFiles)
    }
  }

  if (isProcessingComplete && completedView) {
    return <Box sx={{ mt: '20px', width: '100%' }}>{completedView}</Box>
  }

  const limitReached = fileCount >= maxFiles

  return (
    <Box
      className={`${styles.uploadBox} ${isDragging ? styles.dragActive : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Status Banner */}
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
            backgroundColor: limitReached ? '#FFF4E5' : '#E5F6FD',
            padding: '10px 10px',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: '8px'
          }}
        >
          <Box sx={{ color: limitReached ? '#EF6C00' : '#0288D1' }}>
            <ErrorOutlineIcon />
          </Box>
          <Typography
            sx={{
              color: limitReached ? '#663C00' : '#014361',
              fontWeight: 500,
              fontSize: 'Medium'
            }}
          >
            {fileCount}/{maxFiles} files uploaded
          </Typography>
        </Box>
      </Box>

      {/* Main Illustration */}
      {uploadIcon && (
        <img src={uploadIcon} alt='Upload Icon' width={200} height={100} />
      )}

      <Typography variant='h6' mt={1}>
        {title}
      </Typography>
      <Typography variant='body2' color='textSecondary' mb={1}>
        {subtitle}
      </Typography>
      <Typography variant='body2' color='textPrimary'>
        {fileInfoText}
      </Typography>

      {fileTypeIcon && (
        <img
          style={{ marginTop: '20px' }}
          src={fileTypeIcon}
          alt='File types'
          width={200}
          height={30}
        />
      )}

      <Box
        sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        <Button
          variant='contained'
          component='label'
          disabled={limitReached || disabled}
          className={styles.uploadButton}
          sx={{ mt: 2 }}
        >
          {limitReached
            ? `Limit Reached (${fileCount}/${maxFiles})`
            : 'Browse Files'}
          <input
            hidden
            type='file'
            multiple
            onChange={(e) => e.target.files && onFilesSelected(e.target.files)}
          />
        </Button>
      </Box>
    </Box>
  )
}

export default FileUploadBox
