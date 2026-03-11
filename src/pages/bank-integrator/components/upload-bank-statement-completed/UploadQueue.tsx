import {
  Box,
  Typography,
  IconButton,
  Button,
  LinearProgress
} from '@mui/material'
import { useDispatch, useSelector } from 'react-redux'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import processingIcon from '../../../../../public/assets/processing-icon.svg'
import { useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { getFileIcon } from 'src/utils/getFileIcon'
import spinner from '../../../../assets/spinnergif.gif'
import NotificationBanner from 'src/components/common/NotificationBanner'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { notify } from 'src/components/notistack/NotificationProvider'
import { presignBankStatement } from 'src/services/apis/docsApi'

import { RootState } from 'src/store/store'
import { removeBankStatement } from 'src/store/slices/bankStatementUploadSlice'
import { uploadStatementsToS3 } from 'src/services/apis/handleStartProcessingBankStatements'
import { setPresignStatementsData } from 'src/store/slices/presignedBankstatementsSlice'

export default function UploadQueue() {
  const dispatch = useDispatch()
  const { bankStatements: files } = useSelector(
    (state: RootState) => state.bankStatementUploads
  )
  const { batches } = useSelector(
    (state: RootState) => state.bankStatementProcessing
  )

  const [loading, setLoading] = useState(false)
  const { user, isAuthenticated } = useAuth0()
  const { activePracticeId } = useActivePractice()

  const handleStartProcessing = async () => {
    if (!isAuthenticated) {
      notify.error('Please log in to start document processing.')
      return
    }

    const userId = user?.user_data?.user_metadata?.uuid

    if (!userId) {
      notify.error('User ID not found in Auth0 profile.')
      return
    }

    if (files.length === 0) {
      notify.info('Please upload at least one file before processing.')
      return
    }

    setLoading(true)
    try {
      const response = await presignBankStatement(
        userId,
        files,
        activePracticeId ?? '',
        true
      )
      console.warn('Presign API response:', response)
      const presignData = response.data
      dispatch(setPresignStatementsData(presignData))

      await uploadStatementsToS3(
        presignData.items,
        files,
        presignData.batch_id,
        userId,
        activePracticeId ?? ''
      )
    } catch (error: any) {
      console.error('Error starting processing:', error)
      notify.error(error?.files?.[0])
    } finally {
      setLoading(false)
    }
  }

  const hasProcessingOrCompleted = files.some(
    (f) =>
      f.status === 'processing' ||
      f.status === 'completed' ||
      f.status === 'uploading' ||
      f.status === 'queued'
  )

  // Map batch documents
  const batchDocs = batches.flatMap((batch) =>
    batch.documents.map((doc) => ({
      id: doc.document_id,
      name: doc.file_name,
      size: 0, // backend doesn't send size
      type: 'Document',
      file: null,
      progress: doc.status === 'processing' ? 90 : 100,
      status:
        doc.status === 'processing'
          ? 'processing'
          : doc.status === 'completed'
            ? 'completed'
            : 'queued',
      fromBatch: true,
      batch_id: batch.batch_id
    }))
  )

  // Filter out files that are already in batches
  const filesNotInBatch = files.filter(
    (f) => !batchDocs.some((b) => b.name === f.name)
  )

  // Final list to render
  const combinedList = [...filesNotInBatch, ...batchDocs]
  return (
    <Box mt={3}>
      {hasProcessingOrCompleted && (
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
            Upload queue ({files.length}/5)
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
              <img
                src={processingIcon}
                alt='Processing'
                width={20}
                height={20}
              />
            }
            variant='contained'
            disabled={loading}
            onClick={handleStartProcessing}
          >
            {loading ? 'Processing...' : 'Start Processing Document(s)'}
          </Button>
        </Box>
      )}

      {files.some((f) => f.status === 'queued') && (
        <NotificationBanner content='Please review your uploaded documents carefully, these files will be used to process and update your practice’s financial data.' />
      )}
      {files.some((f) => f.status === 'processing') && (
        <NotificationBanner content='Your documents are now being processed. This may take a few moments, please stay patient while our system analyses and extracts the financial data.' />
      )}

      {combinedList.map((file: any) => {
        return (
          <Box
            key={file.id}
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
              <Box display='flex' alignItems='center' gap={1.2}>
                <img
                  src={getFileIcon(file.name)}
                  alt='file-icon'
                  width={28}
                  height={28}
                />

                <Box textAlign='left'>
                  <Typography variant='body2'>
                    {file.name}
                    {file.fromBatch && ' (Processing)'}
                  </Typography>

                  <Typography variant='caption' color='textSecondary'>
                    {file.fromBatch
                      ? `${file.fileType || 'Unknown'}`
                      : `${(file.size / 1024).toFixed(2)} KB — ${file.type || 'Unknown'}`}
                  </Typography>
                </Box>
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 1
                }}
              >
                <Typography
                  variant='caption'
                  color='textSecondary'
                  display='flex'
                  flexDirection='row'
                  alignItems='center'
                  gap={0.8}
                >
                  {file.status === 'uploading' && (
                    <>
                      <img
                        src={spinner}
                        alt='uploading'
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }}
                      />
                      Uploading... {file.progress || 0}%
                    </>
                  )}
                </Typography>

                {/* Remove button only for uploaded files */}
                {/* {!file.fromBatch &&
                file.status !== 'completed' &&
                file.status !== 'processing' &&
                !loading && ( */}
                <IconButton
                  onClick={() => dispatch(removeBankStatement(file.id))}
                  size='small'
                  color='error'
                >
                  <CancelOutlinedIcon />
                </IconButton>
                {/* )} */}
              </Box>
            </Box>

            {(file.status === 'uploading' || file.status === 'processing') && (
              <LinearProgress
                variant='determinate'
                value={file.progress || (file.status === 'processing' ? 90 : 0)}
                sx={{
                  height: 6,
                  borderRadius: '4px',
                  backgroundColor: '#e0e0e0',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#2E7D32'
                  }
                }}
              />
            )}
          </Box>
        )
      })}
    </Box>
  )
}
