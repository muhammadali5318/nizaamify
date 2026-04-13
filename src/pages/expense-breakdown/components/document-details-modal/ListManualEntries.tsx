// ManualListColumn.tsx
import React, { useState } from 'react'
import {
  Box,
  Typography,
  Divider,
  // IconButton,
  // CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Button,
  CircularProgress,
  IconButton
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ArticleIcon from '@mui/icons-material/Article'
import { bytesToReadableSize } from 'src/utils/bytesToMB'
import DeleteDocumentModal from 'src/pages/documents/components/DeleteDocumentModal'
import { notify } from 'src/components/notistack/NotificationProvider'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { queryClient } from 'src/utils/queryClient'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { useDownloadHistoryDoc } from 'src/hooks/useDownloadHistoryDoc'

type ManualEntry = {
  id: string
  amount: string
  supporting_docs?: Array<{
    id: string
    file_name: string
    file_size?: string | number
    file_obj_key?: string
  }>
}

interface ManualListColumnProps {
  title: string
  docs: ManualEntry[]
  page?: number
  pageSize?: number
  total?: number
  downloadingKey: string | null
  listKey: string
  onPageChange?: (page: number, pageSize: number) => void
  closeParent: () => void
  onDownload: (listKey: string, id: string, indexKey: string | number) => void
}

const manualEntriesContent = (
  <Box>
    <Typography variant='subtitle1'>
      Are you sure you want to delete this manual entry?
    </Typography>

    <Typography variant='subtitle1' sx={{ mt: 1 }}>
      Deleting this entry will permanently remove it and reverse all related
      financial calculations recorded in the system.
    </Typography>

    <Typography variant='subtitle1' sx={{ mt: 1 }}>
      This action cannot be undone.
    </Typography>
  </Box>
)

const bankConnectorContent = (
  <Box>
    <Typography variant='subtitle1'>
      Are you sure you want to delete this bank connector entry?
    </Typography>

    <Typography variant='subtitle1' sx={{ mt: 1 }}>
      Deleting this entry will permanently remove it and reverse all related
      financial calculations recorded in the system.
    </Typography>

    <Typography variant='subtitle1' sx={{ mt: 1 }}>
      This action cannot be undone.
    </Typography>
  </Box>
)

export default function ManualListColumn({
  title,
  docs,
  page = 1,
  pageSize = 10,
  total = 0,
  listKey,
  // downloadingKey,
  onPageChange,
  // onDownload,
  closeParent
}: ManualListColumnProps) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / (pageSize || 10)))
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const { activePracticeId } = useActivePractice()
  const [loading, setLoading] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null)
  const [expanded, setExpanded] = useState<string | false>(false)
  const { downloadingId, download } = useDownloadHistoryDoc()

  const handleExpand = (panel: string) => (_: any, isExpanded: boolean) =>
    setExpanded(isExpanded ? panel : false)

  const handleDeleteClick = (doc: any) => {
    setSelectedDoc(doc)
    setIsDeleteOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedDoc) return
    try {
      setLoading(true)
      await apiClient.delete(
        endpoints.documents.deleteDocument(
          activePracticeId ?? '',
          selectedDoc?.id
        ),
        {
          params: { module: listKey }
        }
      )

      notify.success('Selected item has been deleted successfully')
      setIsDeleteOpen(false)
      setSelectedDoc(null)
      closeParent?.()
      await queryClient.invalidateQueries({
        queryKey: ['allExpenseBreakDown']
      })
      await queryClient.invalidateQueries({
        queryKey: ['useFetchNonPL']
      })
    } catch (error) {
      console.error('Delete error:', error)
      notify.error('Failed to delete the item')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 260,
        borderRadius: '12px',
        background: 'var(--grey-50, #fafafa)',
        padding: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 1
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 1
        }}
      >
        <Typography variant='subtitle1' fontWeight={700}>
          {title}
        </Typography>
      </Box>

      <Divider sx={{ mx: 1 }} />

      {docs && docs.length > 0 ? (
        docs.map((entry, rowIndex) => {
          const count = (entry.supporting_docs || []).length
          const hasDocs = count > 0
          const panelId = `manual-row-${entry.id || rowIndex}`

          return (
            <React.Fragment key={panelId}>
              <Accordion
                expanded={hasDocs && expanded === panelId}
                onChange={handleExpand(panelId)}
                disableGutters
                elevation={0}
                square
                sx={{
                  borderRadius: '12px',
                  border: '1px solid',
                  borderColor: 'grey.200',
                  boxShadow: 'none',
                  '&:before': {
                    display: 'none'
                  },
                  overflow: 'hidden'
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box
                    sx={{
                      display: 'flex',
                      width: '100%',
                      alignItems: 'center',
                      gap: 2
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ArticleIcon fontSize='small' color='action' />
                      <Box>
                        <Typography
                          variant='body2'
                          fontWeight={600}
                          noWrap
                          title={`Amount: £${entry.amount}`}
                        >
                          {entry.amount != null
                            ? `£${Math.abs(Number(entry.amount))}`
                            : '-'}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ flex: 1 }} />

                    <Typography
                      variant='caption'
                      color='text.secondary'
                      sx={{ mr: 1 }}
                    >
                      {count} doc{count !== 1 ? 's' : ''}
                    </Typography>
                    <IconButton
                      size='small'
                      onClick={() => handleDeleteClick(entry)}
                    >
                      <img
                        src='/assets/active-trash.svg'
                        alt='delete'
                        style={{
                          width: 20,
                          height: 20,
                          display: 'block'
                        }}
                      />
                    </IconButton>
                  </Box>
                </AccordionSummary>

                <AccordionDetails>
                  <List dense>
                    {(entry.supporting_docs ?? []).map((sdoc, docIndex) => {
                      // const spinnerKey = `manual-${rowIndex}-${docIndex}`
                      return (
                        <ListItem
                          key={`sdoc-${rowIndex}-${docIndex}`}
                          divider
                          disableGutters
                          secondaryAction={
                            title === 'Bank Connector' ? (
                              <IconButton
                                edge='end'
                                size='small'
                                aria-label={`download-${rowIndex}-${docIndex}`}
                                onClick={() => download(sdoc?.id)}
                              >
                                {downloadingId === sdoc?.id ? (
                                  <CircularProgress size={18} />
                                ) : (
                                  <img
                                    src='/assets/document-download.svg'
                                    alt='download'
                                    style={{ width: 20, height: 20 }}
                                  />
                                )}
                              </IconButton>
                            ) : null
                          }
                        >
                          <ArticleIcon fontSize='small' sx={{ mr: 1 }} />

                          <ListItemText
                            primary={
                              <Typography
                                variant='body2'
                                noWrap
                                title={sdoc.file_name}
                              >
                                {sdoc.file_name}
                              </Typography>
                            }
                            secondary={
                              <Typography
                                variant='caption'
                                color='text.secondary'
                              >
                                {bytesToReadableSize(
                                  Number(sdoc.file_size) || 0
                                )}
                              </Typography>
                            }
                          />
                        </ListItem>
                      )
                    })}
                  </List>
                </AccordionDetails>
              </Accordion>
            </React.Fragment>
          )
        })
      ) : (
        <Typography
          variant='body2'
          color='text.secondary'
          textAlign='center'
          py={4}
        >
          No items found.
        </Typography>
      )}

      {docs?.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 1,
            pt: 1
          }}
        >
          <Box>
            <Button
              size='small'
              disabled={!onPageChange || page <= 1}
              onClick={() =>
                onPageChange && onPageChange(Math.max(1, page - 1), pageSize)
              }
            >
              Prev
            </Button>

            <Button
              size='small'
              disabled={!onPageChange || page >= totalPages}
              onClick={() =>
                onPageChange &&
                onPageChange(Math.min(totalPages, page + 1), pageSize)
              }
            >
              Next
            </Button>
          </Box>
          <Typography variant='caption'>
            Page {page} of {totalPages}
          </Typography>
        </Box>
      )}

      <DeleteDocumentModal
        open={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        loading={loading}
        document={selectedDoc}
        title={
          listKey === 'manual_entries'
            ? '  Confirm Manual entry deletion'
            : '  Confirm bank connector entry deletion'
        }
        content={
          listKey === 'manual_entries'
            ? manualEntriesContent
            : bankConnectorContent
        }
      />
    </Box>
  )
}
