import {
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Tooltip,
  Stack,
  LinearProgress
} from '@mui/material'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from 'src/store/store'
import { useEffect, useMemo, useState } from 'react'
import { getFileIcon } from 'src/utils/getFileIcon'
import { notify } from '../../../../components/notistack/NotificationProvider'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import spinner from '../../../../assets/spinnergif.gif'

import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'

import {
  clearAll,
  removeDocumentsFromBatch
} from 'src/store/slices/processedBankStatementBatchDataSlice'
import { clearAllBankStatements } from 'src/store/slices/bankStatementUploadSlice'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { clearProcessing } from 'src/store/slices/bankstatementProcessingSlice'
import { deleteBatchDocuments } from 'src/services/apis/deleteBatchDocuments'
import { setActiveTab } from 'src/store/slices/bankIntegratorTabSlice'
import { paths } from 'src/paths'
import { useNavigate } from 'react-router'
import { queryClient } from 'src/utils/queryClient'
import { clearPresignStatementsData } from 'src/store/slices/presignedBankstatementsSlice'
import NotificationBanner from 'src/components/common/NotificationBanner'
import DeletedDocumentsList from 'src/pages/documents/components/DeletedDocumentsList'

export default function ProcessingCompletedListForStatement() {
  const navigate = useNavigate()
  const [deletingIds, setDeletingIds] = useState<string[]>([])
  const [hasTriggered, setHasTriggered] = useState(false)

  const dispatch = useDispatch()
  const [progressMap, setProgressMap] = useState<Record<string, number>>({})
  const batches = useSelector(
    (state: RootState) => state.processedBankStatement.batches
  )
  const deletedDocs = useSelector(
    (state: RootState) =>
      state.processedBankStatement.deletedDocumentsDueToTimeout
  )
  const { activePracticeId, accountingBasis } = useActivePractice()

  // -------------- stabilize allDocuments (memo) ----------------
  const allDocuments = useMemo(
    () =>
      Object.values(batches).flatMap((batch: any) =>
        (batch.documents || []).map((doc: any) => ({
          ...doc,
          batch_id: batch.batch_id
        }))
      ),
    [batches]
  )

  // helper to derive booleans from memoized docs
  const areAllDocumentsProcessed = useMemo(
    () =>
      allDocuments.length > 0 &&
      allDocuments.every(
        (doc) => doc.status === 'SUCCESS' || doc.status === 'UNKNOWN'
      ),
    [allDocuments]
  )

  const successfulDocs = useMemo(
    () => allDocuments.filter((doc) => doc.status === 'SUCCESS'),
    [allDocuments]
  )
  const isTotalTimeout = successfulDocs?.length === 0 && deletedDocs?.length > 0

  // ensure we use a stable pending count for effect dependencies
  const pendingCount = useMemo(
    () => allDocuments.filter((d) => d.status === 'PENDING').length,
    [allDocuments]
  )

  const handleContinue = () => {
    dispatch(clearAll())
    dispatch(clearAllBankStatements())
    dispatch(clearProcessing())
    dispatch(clearPresignStatementsData())

    if (accountingBasis === 'CASH') {
      dispatch(setActiveTab(1))
    } else if (accountingBasis === 'ACCRUAL') {
      dispatch(setActiveTab(2))
    }

    navigate(paths.bankIntegrator)

    queryClient.invalidateQueries({
      queryKey: ['unverifiedTransactionsListApi']
    })
    queryClient.invalidateQueries({
      queryKey: ['uncategorisedTransactions']
    })
  }

  useEffect(() => {
    if (areAllDocumentsProcessed && !hasTriggered) {
      setHasTriggered(true)
      handleContinue()
    }
  }, [areAllDocumentsProcessed, hasTriggered])

  // ------------- initialize progress entries for new docs ------------
  useEffect(() => {
    if (!allDocuments.length) return
    setProgressMap((prev) => {
      // don't mutate prev; create next object
      const next: Record<string, number> = { ...prev }
      let changed = false

      allDocuments.forEach((doc) => {
        const id = doc.document_id ?? doc.id
        if (next[id] === undefined) {
          // set to 100 for already-successful docs, else 0
          next[id] =
            doc.status === 'SUCCESS' || doc.status === 'UNKNOWN' ? 100 : 0
          changed = true
        } else {
          // if doc became SUCCESS/UNKNOWN after previously lower progress, set to 100
          if (
            (doc.status === 'SUCCESS' || doc.status === 'UNKNOWN') &&
            next[id] !== 100
          ) {
            next[id] = 100
            changed = true
          }
        }
      })

      return changed ? next : prev
    })
  }, [allDocuments])

  // ---------------- dummy progress interval -- only while there are pending docs ----------------
  useEffect(() => {
    if (pendingCount === 0) return // nothing to animate

    const interval = setInterval(() => {
      setProgressMap((prev) => {
        // build new map only if something changes
        const next = { ...prev }
        let anyChange = false

        allDocuments.forEach((doc) => {
          const id = doc.id
          const current = next[id] ?? 0

          if (doc.status === 'PENDING') {
            // increment but cap below 90 so we don't jump to 100 until SUCCESS
            const increment = Math.random() * 4 + 1
            const newVal = Math.min(90, current + increment)
            if (Math.abs(newVal - current) > 0.0001) {
              next[id] = newVal
              anyChange = true
            }
          } else if (doc.status === 'SUCCESS' || doc.status === 'UNKNOWN') {
            if (current !== 100) {
              next[id] = 100
              anyChange = true
            }
          }
        })

        return anyChange ? next : prev
      })
    }, 400)

    return () => clearInterval(interval)
    // depend on pendingCount so the interval will be cleared when there are no pending docs
  }, [pendingCount, allDocuments])

  // ----------------- move retry side-effect out of render -----------------
  useEffect(() => {
    if (
      allDocuments.length === 0 &&
      (!deletedDocs || deletedDocs.length === 0)
    ) {
      // small safety: only dispatch if store isn't already cleared
      dispatch(clearAll())
      dispatch(clearAllBankStatements())
      dispatch(clearProcessing())
    }
  }, [allDocuments.length, deletedDocs?.length])

  // ---------- NEW: remove single document from batch ----------
  const handleRemoveDocument = async (doc: any) => {
    if (!activePracticeId) {
      notify.error('No active practice selected')
      return
    }
    const docId = doc.id
    const batchId = doc.batch_id
    if (!docId || !batchId) {
      notify.error('Missing document or batch id')
      return
    }

    try {
      setDeletingIds((s) => [...s, docId])

      await deleteBatchDocuments(activePracticeId, batchId, [], [docId])
      notify.success('Document removed from batch')

      dispatch(
        removeDocumentsFromBatch({
          batchId,
          documentIds: [docId]
        })
      )
    } catch (err: any) {
      console.error('Remove doc failed', err)
      notify.error(err?.response?.data?.message || 'Failed to remove document')
    } finally {
      setDeletingIds((s) => s.filter((id) => id !== docId))
    }
  }
  // ------------------------------------------------------------

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

            {/* <Button
              variant='contained'
              color='success'
              disabled={!areAllDocumentsProcessed}
              startIcon={<CheckCircleOutlineOutlinedIcon />}
              onClick={() => {
                dispatch(clearAll())
                dispatch(clearAllBankStatements())
                dispatch(clearProcessing())
                dispatch(clearPresignStatementsData())
                if (accountingBasis === 'CASH') {
                  dispatch(setActiveTab(1))
                } else if (accountingBasis === 'ACCRUAL') {
                  dispatch(setActiveTab(2))
                }
                navigate(paths.bankIntegrator)
                queryClient.invalidateQueries({
                  queryKey: ['unverifiedTransactionsListApi']
                })
                queryClient.invalidateQueries({
                  queryKey: ['uncategorisedTransactions']
                })
              }}
            >
              Continue
            </Button> */}
          </Box>
          <NotificationBanner
            backgroundColor='rgba(239, 108, 0, 0.04)'
            borderColor='#ff9800'
            iconColor='#ef6c00'
            textColor='#ef6c00'
            content='The Bank Connector module accepts only bank statements. All other document types will be automatically removed.'
          />
          <NotificationBanner
            backgroundColor='rgba(239, 108, 0, 0.04)'
            borderColor='#ff9800'
            iconColor='#ef6c00'
            textColor='#ef6c00'
            content='Please note that large bank statements require additional processing time and are best uploaded individually to prevent potential timeouts. Smaller statements may be uploaded in multiple batches.'
          />
        </>
      )}

      {allDocuments?.map((doc) => {
        const id = doc.document_id ?? doc.id
        const progress = Math.round((progressMap[id] ?? 0) * 100) / 100

        const isDuplicateTransactionError = doc?.error_message !== null

        return (
          <Box
            key={id}
            sx={{
              mb: '10px',
              borderRadius: '16px',
              border: '1px solid #eee',
              padding: '10px 16px'
            }}
          >
            <Stack spacing='10px'>
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
                    <Typography variant='subtitle2' fontWeight='700'>
                      {doc.file_name}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      File Format:{' '}
                      {doc.file_name.split('.').pop()?.toUpperCase()}
                    </Typography>
                  </Box>
                </Box>

                <Box display='flex' gap={1} alignItems='center'>
                  {!isDuplicateTransactionError && doc.status !== 'SUCCESS' && (
                    <img
                      src={spinner}
                      alt='processing'
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}
                    />
                  )}

                  <Typography variant='caption' fontStyle='italic'>
                    {isDuplicateTransactionError
                      ? 'Error processing file'
                      : doc.status === 'SUCCESS'
                        ? 'Processed'
                        : 'Processing...'}
                  </Typography>

                  <Tooltip title='Remove Document from batch' placement='top'>
                    <IconButton
                      onClick={() => handleRemoveDocument(doc)}
                      disabled={deletingIds.includes(doc.id)}
                      sx={{ borderColor: 'error.main', color: 'error.main' }}
                    >
                      {deletingIds.includes(doc.id) ? (
                        <CircularProgress size={16} />
                      ) : (
                        <CancelOutlinedIcon />
                      )}
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              {isDuplicateTransactionError ? (
                <Box
                  sx={{
                    backgroundColor: '#FEF2F2',
                    borderRadius: '8px',
                    border: '1px solid #FCA5A5',
                    p: 2,
                    textAlign: 'left'
                  }}
                  role='alert'
                  aria-live='polite'
                >
                  <Stack
                    direction='row'
                    spacing={2}
                    alignItems='center'
                    sx={{ mb: 1 }}
                  >
                    <ErrorOutlineIcon sx={{ color: '#DC2626', fontSize: 22 }} />
                    <Typography
                      variant='subtitle2'
                      sx={{ fontWeight: 700, color: '#DC2626' }}
                    >
                      Duplicate transaction detected
                    </Typography>
                  </Stack>

                  <Typography variant='body2' sx={{ color: '#7F1D1D' }}>
                    Duplicate transactions were found in this statement. It may
                    have already been processed, so this file has been removed
                    from the batch.
                  </Typography>
                </Box>
              ) : doc.status === 'PENDING' ||
                doc.status === 'SUCCESS' ||
                doc.status === 'UNKNOWN' ? (
                <LinearProgress
                  variant='determinate'
                  value={progress}
                  sx={{
                    height: 6,
                    borderRadius: '4px',
                    backgroundColor: '#e0e0e0',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#0288d1'
                    }
                  }}
                />
              ) : (
                <Box
                  sx={{
                    backgroundColor: '#FEF2F2',
                    borderRadius: '8px',
                    border: '1px solid #FCA5A5',
                    p: 2,
                    textAlign: 'left'
                  }}
                  role='alert'
                  aria-live='polite'
                >
                  <Stack
                    direction='row'
                    spacing={2}
                    alignItems='center'
                    sx={{ mb: 1 }}
                  >
                    <ErrorOutlineIcon sx={{ color: '#DC2626', fontSize: 22 }} />
                    <Typography
                      variant='subtitle2'
                      sx={{ fontWeight: 700, color: '#DC2626' }}
                    >
                      Processing failed
                    </Typography>
                  </Stack>

                  <Typography variant='body2' sx={{ color: '#7F1D1D' }}>
                    This document could not be processed. Please remove it from
                    the batch, then continue with the remaining documents.
                  </Typography>
                </Box>
              )}
            </Stack>
          </Box>
        )
      })}
      <DeletedDocumentsList
        deletedDocs={deletedDocs}
        isTotalTimeout={isTotalTimeout}
        onRetry={() => {
          dispatch(clearAll())
          dispatch(clearAllBankStatements())
          dispatch(clearProcessing())
        }}
      />
    </Box>
  )
}
