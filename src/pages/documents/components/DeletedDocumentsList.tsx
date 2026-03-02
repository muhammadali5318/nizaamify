import { Box, Typography, Card, Button } from '@mui/material'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import { getFileIcon } from 'src/utils/getFileIcon'

interface DeletedDocumentsListProps {
  deletedDocs: any
  isTotalTimeout: boolean
  onRetry: () => void
}

export default function DeletedDocumentsList({
  deletedDocs,
  isTotalTimeout,
  onRetry
}: DeletedDocumentsListProps) {
  if (deletedDocs.length === 0) return null

  // --- View for Partial Timeout (List at the bottom) ---
  return (
    <Card
      sx={{
        borderRadius: '12px',
        boxShadow: '0px 2px 6px rgba(0,0,0,0.08)',
        border: '1px solid #e5e7eb',
        p: 2
      }}
    >
      <Box>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            width: '100%'
          }}
        >
          <Typography variant='subtitle1' fontWeight='700' color='error.main'>
            Timed out items ({deletedDocs.length})
          </Typography>
          <Typography variant='body2' color='text.secondary' mb={2}>
            These documents took too long to process and were removed from this
            batch.
          </Typography>
        </Box>

        {deletedDocs.map((doc: any) => (
          <Card
            key={doc.document_id}
            sx={{
              mb: 1,
              opacity: 0.7,
              border: '1px dashed #FDA29B',
              bgcolor: '#FFF5F5',
              boxShadow: 'none'
            }}
          >
            <Box p={2} display='flex' alignItems='center' gap={2}>
              <img src={getFileIcon(doc.file_name)} alt='file' width={24} />
              <Box>
                <Typography
                  variant='body2'
                  fontWeight='600'
                  color='text.secondary'
                >
                  {doc.file_name}
                </Typography>
              </Box>
              <Typography
                variant='caption'
                sx={{
                  color: '#B42318',
                  fontWeight: 'bold',
                  ml: 'auto',
                  bgcolor: '#FEE4E2',
                  px: 1,
                  borderRadius: '4px'
                }}
              >
                TIMEOUT REMOVED
              </Typography>
            </Box>
          </Card>
        ))}
        {isTotalTimeout && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              width: '100%'
            }}
          >
            <Button
              variant='outlined'
              startIcon={<CloudUploadOutlinedIcon />}
              onClick={onRetry}
              sx={{ mt: 1, textTransform: 'none', fontWeight: 600 }}
            >
              Upload documents again
            </Button>
          </Box>
        )}
      </Box>
    </Card>
  )
}
