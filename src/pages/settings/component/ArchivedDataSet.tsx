import React from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Skeleton,
  Stack,
  Typography
} from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import { endpoints } from 'src/services/backendUrl'
import { useActivePractice } from 'src/hooks/useActivePractice'
import apiClient from 'src/services/api-client'
import { notify } from 'src/components/notistack/NotificationProvider'
import { fetchAndSaveFile } from 'src/utils/downloadFileUtils'
import { getDateRangeLabel } from 'src/utils/stringUtils'

type ExportData = {
  id: string
  practice_id: string
  exported_by?: string
  s3_key: string
  status: string
  file_generated: number
  total_records: number
  start_date: string | null
  end_date: string | null
}

const getStatusChipStyles = (status: string) => {
  const normalized = status?.toUpperCase?.() || 'UNKNOWN'

  switch (normalized) {
    case 'COMPLETED':
      return {
        label: 'Completed',
        sx: {
          bgcolor: 'rgba(46, 125, 50, 0.12)',
          color: 'success.main',
          fontWeight: 700
        }
      }
    case 'PROCESSING':
    case 'PENDING':
      return {
        label: 'Processing',
        sx: {
          bgcolor: 'rgba(245, 124, 0, 0.12)',
          color: 'warning.main',
          fontWeight: 700
        }
      }
    case 'FAILED':
      return {
        label: 'Failed',
        sx: {
          bgcolor: 'rgba(211, 47, 47, 0.12)',
          color: 'error.main',
          fontWeight: 700
        }
      }
    default:
      return {
        label: normalized,
        sx: {
          bgcolor: 'rgba(0, 0, 0, 0.06)',
          color: 'text.secondary',
          fontWeight: 700
        }
      }
  }
}

const getTimestampFromS3Key = (s3Key: string) => {
  const match = s3Key?.match(/\/(\d{8}_\d{6})\//)
  if (!match?.[1]) return 0

  const [datePart, timePart] = match[1].split('_')
  const year = Number(datePart.slice(0, 4))
  const month = Number(datePart.slice(4, 6)) - 1
  const day = Number(datePart.slice(6, 8))
  const hour = Number(timePart.slice(0, 2))
  const minute = Number(timePart.slice(2, 4))
  const second = Number(timePart.slice(4, 6))

  return new Date(year, month, day, hour, minute, second).getTime()
}

const ArchivedDataSet: React.FC = () => {
  const { activePracticeId, activePractice } = useActivePractice()

  const [data, setData] = React.useState<ExportData[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isDownloadingId, setIsDownloadingId] = React.useState<string | null>(
    null
  )
  const [fetchError, setFetchError] = React.useState(false)

  const statusApi = endpoints.accountingBasis.exportPracticeDataHistory(
    activePracticeId ?? ''
  )

  const fetchStatus = async () => {
    if (!activePracticeId) {
      setData([])
      setFetchError(true)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setFetchError(false)

      const response = await apiClient.get(statusApi)
      const respData = response?.data?.data

      const normalizedData: ExportData[] = Array.isArray(respData)
        ? respData
        : respData
          ? [respData]
          : []

      const sortedData = [...normalizedData].sort(
        (a, b) =>
          getTimestampFromS3Key(b.s3_key) - getTimestampFromS3Key(a.s3_key)
      )

      setData(sortedData)
    } catch (err) {
      console.error(err)
      setData([])
      setFetchError(true)
    } finally {
      setIsLoading(false)
    }
  }

  React.useEffect(() => {
    fetchStatus()
  }, [activePracticeId])

  const handleDownload = async (item: ExportData) => {
    if (!activePracticeId || !item?.id) {
      notify.error('Export data not available.')
      return
    }

    if (item.status !== 'COMPLETED') {
      notify.error('This export is not ready yet.')
      return
    }

    try {
      setIsDownloadingId(item.id)

      const resp = await apiClient.get(
        endpoints.documents.downloaduploadedDocument(activePracticeId, item.id),
        {
          params: { module: 'export_data' }
        }
      )

      const fileUrl = resp?.data?.data

      if (!fileUrl) {
        notify.error('File not found.')
        return
      }

      const practiceName = activePractice?.practice_name || 'practice'
      const dateRange = getDateRangeLabel(item.start_date, item.end_date)

      const fileName = dateRange
        ? `${practiceName}_export_${dateRange}.zip`
        : `${practiceName}_export.zip`
      await fetchAndSaveFile(fileUrl, fileName)
    } catch (err) {
      console.error(err)
      notify.error('Download failed. Please try again.')
    } finally {
      setIsDownloadingId(null)
    }
  }

  if (isLoading) {
    return (
      <Box
        sx={{
          width: '100%',
          p: 3,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'rgba(0,0,0,0.12)',
          background: 'linear-gradient(180deg, #fff 0%, #fafcff 100%)'
        }}
      >
        <Stack spacing={2}>
          <Skeleton variant='text' width='45%' height={28} />
          <Skeleton variant='rounded' height={92} />
          <Skeleton variant='rounded' height={92} />
        </Stack>
      </Box>
    )
  }

  if (fetchError) {
    return (
      <Box
        sx={{
          width: '100%',
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'rgba(13, 71, 161, 0.14)',
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
          p: 3,
          boxShadow: '0 10px 30px rgba(0,0,0,0.04)'
        }}
      >
        <Stack direction='row' spacing={2} alignItems='flex-start'>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(25, 118, 210, 0.08)',
              flexShrink: 0
            }}
          >
            <InfoOutlinedIcon sx={{ color: 'primary.main', fontSize: 30 }} />
          </Box>

          <Stack spacing={1} flex={1}>
            <Typography variant='h6' fontWeight={700}>
              No export history available yet
            </Typography>

            <Typography variant='body2' color='text.secondary'>
              Export files will appear here after the accounting basis switch
              process is completed.
            </Typography>
          </Stack>
        </Stack>
      </Box>
    )
  }

  if (!data.length) {
    return (
      <Box
        sx={{
          width: '100%',
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'rgba(0,0,0,0.12)',
          background: '#fff',
          p: 3
        }}
      >
        <Stack spacing={1}>
          <Typography variant='h6' fontWeight={700}>
            Export history
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            No archived exports have been generated yet.
          </Typography>
        </Stack>
      </Box>
    )
  }

  const practiceName = activePractice?.practice_name || 'this practice'

  return (
    <Box display='flex' flexDirection='column' gap={2}>
      <Stack spacing={0.5}>
        <Typography variant='h6' fontWeight={800}>
          Archived exports
        </Typography>
        <Typography variant='body2' color='text.secondary'>
          Download any saved export from {practiceName}. The most recent export
          is shown first.
        </Typography>
      </Stack>

      <Card
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'rgba(25, 118, 210, 0.16)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)'
        }}
      >
        <CardContent sx={{ p: 0 }}>
          <Box
            sx={{
              px: 2.5,
              py: 2,
              borderBottom: '1px solid',
              borderColor: 'rgba(0,0,0,0.08)'
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              justifyContent='space-between'
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              spacing={1}
            >
              <Stack direction='row' spacing={1.25} alignItems='center'>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(25, 118, 210, 0.08)'
                  }}
                >
                  <InsertDriveFileOutlinedIcon color='primary' />
                </Box>

                <Stack spacing={0.25}>
                  <Typography fontWeight={800}>
                    Latest export available
                  </Typography>
                </Stack>
              </Stack>

              <Chip
                label={`${data.length} export${data.length > 1 ? 's' : ''}`}
                size='small'
                variant='outlined'
              />
            </Stack>
          </Box>

          <Stack spacing={0} divider={<Divider flexItem />}>
            {data.map((item, index) => {
              const isLatest = index === 0
              const statusChip = getStatusChipStyles(item.status)
              const isDownloading = isDownloadingId === item.id
              const canDownload = item.status === 'COMPLETED'

              return (
                <Box
                  key={item.id}
                  sx={{
                    p: 2.5,
                    backgroundColor: isLatest
                      ? 'rgba(25, 118, 210, 0.03)'
                      : '#fff'
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={2}
                    alignItems={{ xs: 'stretch', md: 'center' }}
                    justifyContent='space-between'
                  >
                    <Stack direction='row' spacing={2} alignItems='flex-start'>
                      <Box
                        sx={{
                          width: 52,
                          height: 52,
                          borderRadius: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'rgba(25, 118, 210, 0.08)',
                          flexShrink: 0
                        }}
                      >
                        <InsertDriveFileOutlinedIcon color='primary' />
                      </Box>

                      <Stack spacing={0.75}>
                        <Stack
                          direction='row'
                          spacing={1}
                          alignItems='center'
                          flexWrap='wrap'
                        >
                          <Typography fontWeight={800}>
                            Archived export file
                          </Typography>

                          {isLatest && (
                            <Chip
                              label='Latest'
                              size='small'
                              sx={{
                                bgcolor: 'rgba(25, 118, 210, 0.12)',
                                color: 'primary.main',
                                fontWeight: 700
                              }}
                            />
                          )}

                          <Chip
                            label={statusChip.label}
                            size='small'
                            sx={statusChip.sx}
                          />
                        </Stack>

                        <Typography variant='body2' color='text.secondary'>
                          {typeof item.total_records === 'number'
                            ? `${item.total_records} records included`
                            : 'Records included'}{' '}
                          •{' '}
                          {typeof item.file_generated === 'number'
                            ? `${item.file_generated} files`
                            : '1 zipped file'}
                        </Typography>

                        <Typography variant='caption' color='text.secondary'>
                          Exported by: {item.exported_by || 'Unknown'}
                        </Typography>
                      </Stack>
                    </Stack>

                    <Stack
                      direction='row'
                      spacing={1.5}
                      alignItems='center'
                      justifyContent={{ xs: 'flex-start', md: 'flex-end' }}
                      flexWrap='wrap'
                    >
                      <Button
                        variant='contained'
                        startIcon={<DownloadOutlinedIcon />}
                        onClick={() => handleDownload(item)}
                        disabled={!canDownload || isDownloading}
                      >
                        {isDownloading ? 'Downloading...' : 'Download'}
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              )
            })}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}

export default ArchivedDataSet
