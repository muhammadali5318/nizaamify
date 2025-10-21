import { Box, Typography, IconButton, Button } from '@mui/material'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../../store/store'
import { removeFile } from '../../../store/slices/uploadSlice'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import processingIcon from '../../../../public/assets/processing-icon.svg'
import { presignDocuments } from '../../../services/apis/docsApi'
import { notify } from '../../../components/notistack/NotificationProvider'
import { useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { uploadFilesToS3 } from 'src/services/apis/handleStartProcessing'
import { setPresignData } from 'src/store/slices/presignedSlice'

export default function UploadQueue() {
  const dispatch = useDispatch()
  const { files } = useSelector((state: RootState) => state.uploads)
  const [loading, setLoading] = useState(false)
  const { user, isAuthenticated } = useAuth0()

  const handleStartProcessing = async () => {
    if (!isAuthenticated) {
      notify.error('Please log in to start document processing.')
      return
    }

    const userId = user?.user_data?.user_metadata?.uuid
    const org_id = user?.organizations_with_roles[0].metadata.uuid

    if (!userId) {
      notify.error('User UUID not found in Auth0 profile.')
      return
    }

    if (files.length === 0) {
      notify.info('Please upload at least one file before processing.')
      return
    }

    setLoading(true)
    try {
      const response = await presignDocuments(userId, files, org_id)
      console.warn('Presign API response:', response)
      const presignData = response.data
      dispatch(setPresignData(presignData))

      notify.success('Pre-signed URLs generated successfully!')

      await uploadFilesToS3(
        presignData.items,
        files,
        presignData.batch_id,
        userId,
        org_id
      )
    } catch (error: any) {
      console.error('Error starting processing:', error)
      notify.error('Failed to start document processing.')
    } finally {
      setLoading(false)
    }
  }

  if (files.length === 0) return null

  return (
    <Box mt={3}>
      <Box
        mb={2}
        sx={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline'
        }}
      >
        <Typography variant='subtitle1' mb={1}>
          Upload Queue ({files.length}/5)
        </Typography>

        <Button
          sx={{
            background: '#2E7D32',
            color: '#fff',
            borderRadius: '12px',
            textTransform: 'none',
            '&:hover': { background: '#256528' }
          }}
          startIcon={
            <img src={processingIcon} alt='Processing' width={20} height={20} />
          }
          variant='contained'
          disabled={loading}
          onClick={handleStartProcessing}
        >
          {loading ? 'Processing...' : 'Start documents processing'}
        </Button>
      </Box>

      {files.map((file) => (
        <Box
          key={file.id}
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 12px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            mb: 1
          }}
        >
          <Box>
            <Typography variant='body2'>{file.name}</Typography>
            <Typography variant='caption' color='textSecondary'>
              {(file.size / 1024).toFixed(2)} KB — {file.type || 'Unknown'}
            </Typography>
          </Box>
          <IconButton
            onClick={() => dispatch(removeFile(file.id))}
            size='small'
            color='primary'
          >
            <CancelOutlinedIcon />
          </IconButton>
        </Box>
      ))}
    </Box>
  )
}
