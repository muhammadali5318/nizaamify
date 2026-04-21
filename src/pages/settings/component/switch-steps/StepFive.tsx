import React from 'react'
import { Box, Button, Stack, Typography } from '@mui/material'
import { StepProps } from '../../type'
import styles from './switchSteps.module.scss'
import PageHeader from 'src/components/page-header'
import ExportDetails from './ExportDetails'

import { useAppSelector, useAppDispatch } from 'src/store/hooks'
import { clearPendingPracticePayload } from 'src/store/slices/practiceAccountingBasisSlice'
import {
  clearAccountingBasisSwitchData,
  selectAccountingBasisSwitchExportData
} from 'src/store/slices/accountingBasisSwitchSlice'

import { useActivePractice } from 'src/hooks/useActivePractice'
import { queryClient } from 'src/utils/queryClient'
import { notify } from 'src/components/notistack/NotificationProvider'
import { useUpdatePractice } from '../../hooks/usePracticeProfile'
import { paths } from 'src/paths'
import { useNavigate } from 'react-router'

const StepFive: React.FC<StepProps> = ({ onBack }) => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const pendingPayload = useAppSelector(
    (state) => state.practiceAccountingBasis.pendingPayload
  )

  const exportData = useAppSelector(selectAccountingBasisSwitchExportData)

  const { activePracticeId } = useActivePractice()
  const updatePractice = useUpdatePractice(activePracticeId ?? '')

  const handleFinish = async () => {
    if (!pendingPayload) {
      notify.error('No pending data found')
      return
    }

    try {
      await updatePractice.mutateAsync(pendingPayload)

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['initialData'] }),
        queryClient.invalidateQueries({ queryKey: ['listAllPracticesData'] }),
        queryClient.invalidateQueries({
          queryKey: ['UserWithActivePracticeData']
        })
      ])

      dispatch(clearPendingPracticePayload())
      dispatch(clearAccountingBasisSwitchData())

      notify.success('Practice information updated successfully')
      navigate(paths.gotoSettingsTab('archivedDataSet'))
    } catch (error) {
      notify.error('Failed to update practice information')
      console.error(error)
    }
  }

  const totalRecords =
    typeof exportData?.total_records === 'number'
      ? `${exportData.total_records} records`
      : 'N/A'

  const filesGenerated =
    typeof exportData?.file_generated === 'number'
      ? `${exportData.file_generated} files`
      : 'N/A'

  return (
    <Box className={styles.stepTwoRoot}>
      <Box className={styles.stepFourContainer}>
        <Typography variant='subtitle1' color='text.secondary'>
          Step 5 of 5
        </Typography>

        <Stack spacing={2}>
          <PageHeader
            isDividerVisible={false}
            title={'Exporting Your Data'}
            logo={'/assets/docs-export.svg'}
          />

          <Box
            sx={{
              display: 'flex',
              p: 2,
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'flex-start',
              borderRadius: '20px',
              border: '1px solid',
              borderColor: 'rgba(0, 0, 0, 0.20)'
            }}
          >
            <Box display='flex' gap={2} alignItems='flex-start'>
              <img src='/assets/Info-outlined.svg' alt='info icon' />

              <Stack spacing={0.5}>
                <Typography variant='subtitle1'>
                  Your data has been successfully exported and saved.
                </Typography>

                <Box component='ul' sx={{ pl: 4, m: 0 }}>
                  <Box component='li'>
                    <Typography component='span'>
                      Files are available in <strong>Archived Data Set</strong>
                    </Typography>
                  </Box>

                  <Box component='li'>
                    <Typography component='span'>
                      You can download them anytime from{' '}
                      <strong>Practice Settings</strong>
                    </Typography>
                  </Box>
                </Box>
              </Stack>
            </Box>
          </Box>

          <Box display='flex' width='100%' gap={2} flexWrap='wrap'>
            <ExportDetails label='Total Records:' value={totalRecords} />
            <ExportDetails label='Files Generated:' value={filesGenerated} />
          </Box>
        </Stack>

        <Stack direction='row' spacing={2} className={styles.actions}>
          <Button variant='outlined' onClick={onBack}>
            Cancel
          </Button>

          <Button
            variant='contained'
            onClick={handleFinish}
            disabled={updatePractice.isPending || !pendingPayload}
          >
            {updatePractice.isPending ? 'Saving...' : 'Continue to Reset'}
          </Button>
        </Stack>
      </Box>
    </Box>
  )
}

export default StepFive
