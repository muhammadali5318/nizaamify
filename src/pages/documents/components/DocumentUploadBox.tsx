import { Box, Typography, Button } from '@mui/material'
import uploadIcon from '../../../assets/upload-box-icon.svg'
import styles from '../documents.module.scss'
import fileimage from '../../../assets/upload-file-combined-icon.svg'

export default function DocumentUploadBox() {
  return (
    <Box className={styles.uploadBox}>
      <img src={uploadIcon} alt='File types' width={200} height={100} />
      <Typography variant='h6'>
        Upload or drag and drop your financial documents
      </Typography>
      <Typography variant='body2' color='textSecondary' mb={1}>
        You can upload unlimited files but in bulk ony 5 can be uploaded.
      </Typography>
      <Typography variant='body2' color='textPrimary'>
        You can upload unlimited files (up to <strong>10MB </strong>each).
        Supported types:
        <strong>.CSV</strong> , <strong>.PDF</strong>, <strong>.PNG</strong>,
        <strong>.JPG</strong>
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
          className={styles.uploadButton}
        >
          Browse Files
          <input hidden type='file' multiple />
        </Button>
      </Box>
    </Box>
  )
}
