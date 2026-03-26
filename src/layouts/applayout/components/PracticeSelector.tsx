// src/layouts/applayout/components/PracticeSelector.tsx
import Box from '@mui/material/Box'
import {
  Button,
  Divider,
  FormControl,
  MenuItem,
  Radio,
  Select,
  Stack,
  Typography,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import VerifiedIcon from '@mui/icons-material/Verified'
import styles from '../AppLayout.module.scss'
import { useAuth } from 'src/context/AuthProvider'
import { useState, useEffect, useRef } from 'react'
import AddPracticeModal from 'src/pages/practice-settings/components/AddPracticeModal'
import { useFetchAllPracticesData } from 'src/hooks/useFetchAllPracticesData'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { useDispatch } from 'react-redux'
import { setMergedPermissionsByCategory } from 'src/store/slices/userDetailsInActivePracticeSlice'
import { ALL_PERMISSIONS, PRACTICE_TYPE } from 'src/const'
import { deepEqual } from 'src/utils/objectsUtils'
import { notify } from 'src/components/notistack/NotificationProvider'
import { clearAll } from 'src/store/slices/processedBatchDataSlice'
import { clearPresignData } from 'src/store/slices/presignedSlice'
import { clearFiles } from 'src/store/slices/uploadSlice'
import { AllPracticesDataObject } from 'src/store/slices/activePracticeSlice'
import { clearProcessing } from 'src/store/slices/processingSlice'
import { clearProcessing as clearBankStatementProcessing } from 'src/store/slices/bankstatementProcessingSlice'
import { clearAllBankStatements } from 'src/store/slices/bankStatementUploadSlice'
import { clearPresignStatementsData } from 'src/store/slices/presignedBankstatementsSlice'
import { clearAll as clearAllProcessedBankStatements } from 'src/store/slices/processedBankStatementBatchDataSlice'
import useUserDetails from 'src/hooks/useUserDetails'
import {
  setConnectionId,
  setStatus
} from 'src/store/slices/bankConnectionSlice'
import { clearChatStorage } from 'src/store/slices/chatSlice'
import useFetchUnverifiedTransations from 'src/pages/bank-integrator/hooks/useFetchUnverifiedTransactions'
import { resetPresignResponse } from 'src/store/slices/manualEntryFilesSlice'

export default function PracticeSelector() {
  const { isOwnerOrDirectorInAnyPractice, isUserOwnerOrDirector } =
    useUserDetails()
  const { accessToken } = useAuth()
  const dispatch = useDispatch()
  const { data: rawPractices } = useFetchAllPracticesData(!!accessToken)
  const { data } = useFetchUnverifiedTransations(
    { page: 0 },
    isUserOwnerOrDirector
  )

  const isPracticeVerified =
    Number(data?.transactions_counts?.transactions_with_invoices) >= 4
  const updatedPractices: AllPracticesDataObject[] = Array.isArray(rawPractices)
    ? rawPractices
    : rawPractices && Array.isArray((rawPractices as any).results)
      ? (rawPractices as any).results
      : []

  const practices: AllPracticesDataObject[] = updatedPractices?.filter(
    (practice) => practice.status !== 'ARCHIVED'
  )

  const {
    activePracticeId: persistedId,
    activePractice,
    setActiveById
  } = useActivePractice()

  const [selectedPractice, setSelectedPractice] =
    useState<AllPracticesDataObject | null>(null)

  const didInit = useRef(false)

  // INITIALIZATION: set a default when practices first load
  useEffect(() => {
    if (!practices.length || didInit.current) return

    // 1) If Redux already has a valid practice that matches the list -> use it
    if (activePractice) {
      const match = practices.find((p) => p.id === activePractice.id)
      if (match) {
        // If the stored activePractice is stale (same id but different properties),
        // refresh the active practice in the store with the latest `match`.
        if (!deepEqual(match, activePractice)) {
          setActiveById(match.id, practices)
        }
        setSelectedPractice(match)
        didInit.current = true
        return
      }
    }

    // 2) If there's a persisted id (localStorage) -> use that if present in list
    if (persistedId) {
      const match = practices.find((p) => p.id === persistedId)
      if (match) {
        setActiveById(match?.id, practices)
        setSelectedPractice(match)
        didInit.current = true
        return
      }
    }

    // 3) Fallback to first practice
    const first = practices[0]
    if (first) {
      setActiveById(first?.id, practices)
      setSelectedPractice(first)
      didInit.current = true
    }
  }, [practices, rawPractices, activePractice, persistedId, setActiveById]) // run only when the list of practices arrives

  // SYNC: keep local selection in sync whenever activePractice changes
  useEffect(() => {
    if (!practices.length || !activePractice) return
    const match = practices.find((p) => p.id === activePractice.id)
    if (match) {
      // if properties differ, refresh the store copy to the latest `match`
      if (!deepEqual(match, activePractice)) {
        setActiveById(match.id, practices)
      }
      setSelectedPractice(match)
    } else {
      // If the incoming activePractice doesn't match any id,
      // warn (common cause: id field name mismatch, e.g. `practice_id` vs `id`)
      console.warn(
        'activePractice id does not match any loaded practice list items:',
        {
          activePracticeId: activePractice.id,
          loadedPracticeIds: practices.map((p) => p.id)
        }
      )
      // optionally clear or keep previous selection:
      setSelectedPractice(null)
    }
  }, [activePractice, practices, setActiveById])

  const [isAddOpen, setIsAddOpen] = useState(false)

  return (
    <Box
      className={styles.practiceSelector}
      sx={{ display: 'flex', alignItems: 'center' }}
    >
      <img src='/assets/practice-selector.svg' alt='practice selector' />

      <FormControl className={styles.muiSelectForm} fullWidth>
        <Select
          value={selectedPractice?.id ?? ''}
          SelectDisplayProps={{
            style: {
              display: 'flex',
              alignItems: 'center',
              overflow: 'hidden'
            }
          }}
          MenuProps={{ disablePortal: false }}
          onChange={(e) => {
            const selected =
              practices.find((p) => p.id === e.target.value) || null
            dispatch(setMergedPermissionsByCategory(ALL_PERMISSIONS))
            dispatch(clearAll())
            dispatch(clearProcessing())
            dispatch(clearFiles())
            dispatch(clearPresignData())
            localStorage.removeItem('bank_connection_id')
            dispatch(setStatus(null))
            dispatch(setConnectionId(null))
            setSelectedPractice(selected)
            setActiveById(selected?.id ?? '', practices)
            dispatch(clearChatStorage())

            // remove bank integratier data
            dispatch(clearAllProcessedBankStatements())
            dispatch(clearAllBankStatements())
            dispatch(clearBankStatementProcessing())
            dispatch(clearPresignStatementsData())

            // remove mannual entries
            dispatch(resetPresignResponse())

            notify.success('Switched to ' + selected?.practice_name)
          }}
          displayEmpty
          className={styles.muiSelect}
          sx={{
            borderRadius: '16px',
            pl: 2,
            '& .MuiOutlinedInput-notchedOutline': { borderRadius: '16px' },
            '& .MuiSelect-icon': { right: 0 },
            '& .MuiSelect-select': {
              py: 1,
              pr: 5,
              display: 'block',
              whiteSpace: 'normal',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }
          }}
          renderValue={() => (
            <Stack direction='column' spacing={0} sx={{ minWidth: 0 }}>
              {/* Practice name */}
              <Box display={'flex'} gap={1} alignItems={'center'}>
                <Typography
                  variant='subtitle2'
                  noWrap
                  sx={{
                    display: 'block',
                    fontWeight: 700,
                    maxWidth: { xs: '140px', sm: '240px' },
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {selectedPractice?.practice_name || 'Select practice'}{' '}
                </Typography>
                {isPracticeVerified && <VerifiedIcon sx={{ fontSize: 16 }} />}
              </Box>
              <Typography
                variant='caption'
                noWrap
                sx={{
                  maxWidth: { xs: '140px', sm: '240px' },
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  paddingRight: '1px'
                }}
                color={
                  selectedPractice?.onboarding_status !== 'COMPLETED'
                    ? 'error.light'
                    : 'success.light'
                }
                fontWeight={700}
                fontStyle='italic'
              >
                {selectedPractice?.onboarding_status !== 'COMPLETED'
                  ? 'Pending onboarding'
                  : selectedPractice?.practice_type &&
                    PRACTICE_TYPE[selectedPractice.practice_type]}
              </Typography>
            </Stack>
          )}
        >
          {practices.length > 0 ? (
            practices.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                <ListItem
                  disableGutters
                  sx={{
                    width: '100%',
                    padding: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 1.5
                  }}
                >
                  <img
                    src='/assets/practice-selector.svg'
                    alt='practice selector icon'
                  />

                  <ListItemText
                    primary={
                      <Typography variant='body2' fontWeight={700}>
                        {p.practice_name}
                      </Typography>
                    }
                    secondary={
                      <Typography
                        variant='caption'
                        color='var(--color-primary-light)'
                      >
                        {p.email}
                      </Typography>
                    }
                  />

                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Radio checked={selectedPractice?.id === p.id} />
                  </ListItemIcon>
                </ListItem>
              </MenuItem>
            ))
          ) : (
            <MenuItem value=''>
              <Typography variant='body2'>No practices found</Typography>
            </MenuItem>
          )}

          {isOwnerOrDirectorInAnyPractice && <Divider />}

          {isOwnerOrDirectorInAnyPractice && (
            <MenuItem sx={{ padding: '0px 10px' }}>
              <Box
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                style={{ width: '100%' }}
              >
                <Button
                  onClick={() => setIsAddOpen(true)}
                  startIcon={<AddIcon />}
                  fullWidth
                  variant='outlined'
                >
                  Add another practice
                </Button>
              </Box>
            </MenuItem>
          )}
        </Select>
      </FormControl>

      <AddPracticeModal open={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </Box>
  )
}
