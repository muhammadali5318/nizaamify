import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Divider,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material'
import aiIcon from '../../../assets/sparkles.svg'
import editIcon from '../../../assets/message-edit.svg'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from 'src/store/store'
import { useState } from 'react'
import EditDocumentModal from './EditDocumentModal'
import { getFileIcon } from 'src/utils/getFileIcon'
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined'
import verifiedIcon from '../../../../public/assets/verified.svg'
import { approveDocuments } from 'src/services/apis/approveDocs'
import { notify } from '../../../components/notistack/NotificationProvider'
import ConfirmDialog from 'src/components/confirm-dialog/ConfirmDialog'
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import { getModifiedDocuments } from 'src/utils/getModifiedDocs'
import {
  clearAll,
  removeDocumentsFromBatch
} from 'src/store/slices/processedBatchDataSlice'
import { clearFiles } from 'src/store/slices/uploadSlice'
import { useNavigate } from 'react-router'
import { queryClient } from 'src/utils/queryClient'
import NotificationBanner from 'src/components/common/NotificationBanner'
import { useActivePractice } from 'src/hooks/useActivePractice'
import dayjs from 'dayjs'
import { clearProcessing } from 'src/store/slices/processingSlice'
import DeletedDocumentsList from './DeletedDocumentsList'
import { deleteBatchDocuments } from 'src/services/apis/deleteBatchDocuments'

export default function ProcessingCompletedList() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deletingIds, setDeletingIds] = useState<string[]>([]) // <-- track deleting ids
  const dispatch = useDispatch()
  const batches = useSelector((state: RootState) => state.processed.batches)
  const [selectedDoc, setSelectedDoc] = useState<any>(null)
  const [openModal, setOpenModal] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)
  const navigate = useNavigate()
  const deletedDocs = useSelector(
    (state: RootState) => state.processed.deletedDocumentsDueToTimeout
  )
  // const deletedDocsIds = deletedDocs?.map((doc) => doc.document_id)

  const allDocuments = Object.values(batches).flatMap((batch: any) =>
    (batch.documents || []).map((doc: any) => ({
      ...doc,
      batch_id: batch.batch_id
    }))
  )
  const areAllDocumentsProcessed =
    allDocuments?.length > 0 &&
    allDocuments?.every((doc) => doc.status !== 'PENDING')
  const successfulDocs = allDocuments?.filter((doc) => doc.status === 'SUCCESS')
  const isTotalTimeout = successfulDocs.length === 0 && deletedDocs.length > 0
  const { activePracticeId } = useActivePractice()

  console.warn(allDocuments)
  const handleEdit = (doc: any) => {
    setSelectedDoc(doc)
    setOpenModal(true)
  }
  const handleApprove = async () => {
    try {
      setLoading(true)
      const allDocsPayload = getModifiedDocuments(batches)
      const firstBatchId = allDocuments?.[0]?.batch_id

      await approveDocuments(
        activePracticeId ?? '',
        firstBatchId,
        allDocsPayload
      )
      notify.success('Documents approved successfully!')
      await queryClient.invalidateQueries({
        queryKey: ['uploadedDocumentListApi'],
        exact: false
      })
      await queryClient.invalidateQueries({
        queryKey: ['docs', 'counts']
      })
      await deleteBatchDocuments(activePracticeId ?? '', firstBatchId, [], [])

      setSuccessOpen(true)
    } catch (err: any) {
      console.error(err)
      notify.error(err?.response?.data?.message || 'Approval failed')
    } finally {
      setLoading(false)
      setConfirmOpen(false)
    }
  }
  const handleRetry = () => {
    dispatch(clearAll())
    dispatch(clearFiles())
    dispatch(clearProcessing())
  }
  if (allDocuments?.length === 0 && deletedDocs?.length === 0) {
    handleRetry()
  }
  // ---------- NEW: remove single document from batch ----------
  const handleRemoveDocument = async (doc: any) => {
    if (!activePracticeId) {
      notify.error('No active practice selected')
      return
    }
    const docId = doc.document_id
    const batchId = doc.batch_id
    if (!docId || !batchId) {
      notify.error('Missing document or batch id')
      return
    }

    try {
      setDeletingIds((s) => [...s, docId])

      // 1️⃣ Delete document
      await deleteBatchDocuments(activePracticeId, batchId, [], [docId])
      notify.success('Document removed from batch')

      dispatch(
        removeDocumentsFromBatch({
          batchId,
          documentIds: [docId]
        })
      )

      await queryClient.invalidateQueries({
        queryKey: ['uploadedDocumentListApi'],
        exact: false
      })
      await queryClient.invalidateQueries({ queryKey: ['docs', 'counts'] })
    } catch (err: any) {
      console.error('Remove doc failed', err)
      notify.error(err?.response?.data?.message || 'Failed to remove document')
    } finally {
      setDeletingIds((s) => s.filter((id) => id !== docId))
    }
  }
  // ------------------------------------------------------------

  const handleGoToDashboard = () => {
    setSuccessOpen(false)
    dispatch(clearAll())
    dispatch(clearFiles())
    dispatch(clearProcessing())
    setSuccessOpen(false)

    navigate('/dashboard')
  }

  const handleUploadMore = () => {
    dispatch(clearAll())
    dispatch(clearFiles())
    dispatch(clearProcessing())
    setSuccessOpen(false)
  }

  return (
    <Box
      sx={{
        width: { xs: '100%', sm: '96%', md: '100%', lg: '100%' },
        minWidth: '19rem'
      }}
    >
      {!isTotalTimeout && (
        <>
          <Box
            display='flex'
            flexDirection={{ xs: 'column', sm: 'row' }}
            justifyContent='space-between'
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            mb={2}
          >
            <Typography variant='h6' fontWeight='600'>
              {areAllDocumentsProcessed
                ? 'Processing Complete'
                : 'Processing in Progress'}
            </Typography>

            <Button
              variant='contained'
              color='success'
              disabled={!areAllDocumentsProcessed}
              startIcon={<CheckCircleOutlineOutlinedIcon />}
              onClick={() => setConfirmOpen(true)}
            >
              Approve and continue
            </Button>
          </Box>

          <NotificationBanner content='Please ensure you review the extracted data before approving them. The data will be used to produce financial records for your practice.' />
        </>
      )}

      {allDocuments?.map((doc) => (
        <Card
          key={doc.document_id}
          sx={{
            mb: 2,
            borderRadius: '12px',
            boxShadow: '0px 2px 6px rgba(0,0,0,0.08)',
            border: '1px solid #e5e7eb'
          }}
        >
          <CardContent>
            {/* File Header */}
            <Box
              display='flex'
              flexWrap='wrap'
              gap={2}
              alignItems='center'
              justifyContent='space-between'
            >
              <Box display='flex' alignItems='center' gap={2}>
                <img
                  src={getFileIcon(doc.file_name)}
                  alt='File Type'
                  width={28}
                  height={28}
                />
                <Box sx={{ textAlign: 'left' }}>
                  <Typography variant='subtitle1' fontWeight='600'>
                    {doc.file_name}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    File Format:{' '}
                    {doc.file_name.split('.').pop()?.toUpperCase()}{' '}
                  </Typography>
                </Box>
              </Box>
              {areAllDocumentsProcessed && (
                <Box display={'flex'} gap={1}>
                  <Button
                    sx={{
                      background: '#fff',
                      color: '#EF6C00',
                      borderRadius: '12px',
                      border: '1px solid #EF6C00',
                      textTransform: 'none'
                    }}
                    startIcon={
                      <img
                        src={editIcon}
                        alt='Processing'
                        width={20}
                        height={20}
                      />
                    }
                    variant='outlined'
                    onClick={() => handleEdit(doc)}
                  >
                    Edit
                  </Button>

                  <Tooltip title='Remove Document from batch' placement='top'>
                    <IconButton
                      onClick={() => handleRemoveDocument(doc)}
                      disabled={deletingIds.includes(doc.document_id)}
                      sx={{
                        borderColor: 'error.main',
                        color: 'error.main'
                      }}
                    >
                      {deletingIds.includes(doc.document_id) ? (
                        <CircularProgress size={16} />
                      ) : (
                        <CancelOutlinedIcon />
                      )}
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* AI Summary Section */}
            {doc.status === 'PENDING' ? (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  p: 4
                }}
              >
                <CircularProgress />
              </Box>
            ) : (
              <Box>
                <Typography
                  variant='subtitle2'
                  sx={{
                    fontWeight: 600,
                    mb: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    background: '#FAFAFA',
                    padding: '0px 0px 0px 0px',
                    borderRadius: '12px'
                  }}
                >
                  <img src={aiIcon} alt='ai icon'></img> <p>AI summary</p>
                </Typography>

                <Box
                  sx={{
                    backgroundColor: '#F9FAFB',
                    borderRadius: '8px',
                    p: 2,
                    border: '1px solid #E5E7EB',
                    textAlign: 'left'
                  }}
                >
                  <Typography variant='body2' fontWeight='600'>
                    Document summary:
                  </Typography>
                  <Typography
                    variant='body2'
                    sx={{ mt: 0.5, color: '#374151' }}
                  >
                    Date on document:{' '}
                    <strong>
                      {dayjs(doc.document_date).format('DD-MM-YYYY') || '—'}
                    </strong>
                    &nbsp; | &nbsp; Category:{' '}
                    <strong>{doc.document_category || '—'}</strong>
                    &nbsp; | &nbsp; Document category:{' '}
                    <strong>{doc.document_type || '—'}</strong>
                    &nbsp; | &nbsp; Document subcategory:{' '}
                    <strong>{doc.document_subtype || '—'}</strong>
                    {!['Revenue', 'Unknown'].includes(
                      doc.document_category
                    ) && (
                      <>
                        &nbsp; | &nbsp; Line item:{' '}
                        <strong>{doc.expense_category || '—'}</strong>
                      </>
                    )}
                  </Typography>
                  <Divider sx={{ mt: '5px' }} />

                  <Typography
                    variant='body2'
                    fontWeight='600'
                    sx={{ mt: 2, color: '#111827' }}
                  >
                    Financial data summary:
                  </Typography>

                  <Typography
                    variant='body2'
                    sx={{ mt: 0.5, color: '#374151' }}
                  >
                    Extracted amount:{' '}
                    <strong>
                      £ {Number(doc.amount || 0).toLocaleString()}
                    </strong>
                  </Typography>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      ))}
      <DeletedDocumentsList
        deletedDocs={deletedDocs}
        isTotalTimeout={isTotalTimeout}
        onRetry={handleRetry}
      />
      <EditDocumentModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        batchId={selectedDoc?.batch_id || ''}
        document={selectedDoc}
      />
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleApprove}
        icon={
          <ErrorOutlineOutlinedIcon
            sx={{
              fontSize: 48,
              color: '#F97316',
              background: '#FFF7ED',
              borderRadius: '50%',
              p: 1
            }}
          />
        }
        title='Confirm data approval'
        description='Please confirm that all uploaded documents and extracted data are accurate. Once approved, these records will be processed and reflected in your practice’s financial KPIs.'
        confirmText='Approve & continue'
        cancelText='Review again'
        confirmColor='warning'
        loading={loading}
      />
      <ConfirmDialog
        open={successOpen}
        onClose={handleUploadMore}
        onConfirm={handleGoToDashboard}
        icon={<img src={verifiedIcon} alt='Success' />}
        title='Financial data updated successfully'
        description='Your uploaded documents have been processed, and your practice’s financial KPIs have been updated successfully. You can now view the latest insights and benchmarks on your dashboard.'
        confirmText='Go to dashboard'
        cancelText='Upload more documents'
        confirmColor='success'
      />
    </Box>
  )
}
