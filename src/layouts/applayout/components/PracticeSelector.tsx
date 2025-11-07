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
import styles from '../AppLayout.module.scss'
import { toTitleCase } from 'src/utils/stringUtils'
import { useAuth } from 'src/context/AuthProvider'
import { useState, useEffect, useRef } from 'react'
import AddPracticeDialog from 'src/pages/practice-settings/components/AddNewPracticeModal.tsx'
import { useFetchAllPracticesData } from 'src/hooks/useFetchAllPracticesData'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { useDispatch } from 'react-redux'
import { setMergedPermissionsByCategory } from 'src/store/slices/userDetailsInActivePracticeSlice'
import { ALL_PERMISSIONS } from 'src/config/module-permissions'

export type AllPracticesDataObject = {
  id: string
  practice_name: string
  email?: string | null
  practice_type?: string
  address?: string | null
  contact_number?: string | null
  premises_ownership?: string
  accounting_basis?: string
  created_at?: string
  onboarding_status?: string
}

interface PracticeSelectorProps {
  showLabels: boolean
}

export default function PracticeSelector({
  showLabels
}: PracticeSelectorProps) {
  const { accessToken } = useAuth()
  const dispatch = useDispatch()
  const { data: rawPractices } = useFetchAllPracticesData(!!accessToken)

  const practices: AllPracticesDataObject[] = Array.isArray(rawPractices)
    ? rawPractices
    : rawPractices && Array.isArray((rawPractices as any).results)
      ? (rawPractices as any).results
      : []

  const {
    activePracticeId: persistedId,
    activePractice,
    setActivePractice
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
        setSelectedPractice(match)
        didInit.current = true
        return
      }
    }

    // 2) If there's a persisted id (localStorage) -> use that if present in list
    if (persistedId) {
      const match = practices.find((p) => p.id === persistedId)
      if (match) {
        setActivePractice(match)
        setSelectedPractice(match)
        didInit.current = true
        return
      }
    }

    // 3) Fallback to first practice
    const first = practices[0]
    if (first) {
      setActivePractice(first)
      setSelectedPractice(first)
      didInit.current = true
    }
  }, [practices]) // run only when the list of practices arrives

  // SYNC: keep local selection in sync whenever activePractice changes
  useEffect(() => {
    if (!practices.length || !activePractice) return
    const match = practices.find((p) => p.id === activePractice.id)
    if (match) {
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
  }, [activePractice, practices])

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
          onChange={(e) => {
            const selected =
              practices.find((p) => p.id === e.target.value) || null
            dispatch(setMergedPermissionsByCategory(ALL_PERMISSIONS))
            setSelectedPractice(selected)
            setActivePractice(selected)
          }}
          displayEmpty
          className={styles.muiSelect}
          sx={{
            borderRadius: '16px',
            pl: 2,
            '& .MuiOutlinedInput-notchedOutline': { borderRadius: '16px' },
            '& .MuiSelect-icon': { right: 0 },
            '& .MuiSelect-select': { py: 1 }
          }}
          renderValue={() => (
            <Stack padding={'0px'}>
              <Typography
                variant='subtitle2'
                sx={{ display: showLabels ? 'inline' : 'none' }}
              >
                {selectedPractice?.practice_name || 'Select practice'}
              </Typography>

              <Typography
                variant='subtitle2'
                sx={{ display: showLabels ? 'inline' : 'none' }}
                color={
                  selectedPractice?.onboarding_status !== 'COMPLETED'
                    ? 'error.light'
                    : 'success.light'
                }
                fontWeight={700}
                fontStyle={'italic'}
              >
                {selectedPractice?.onboarding_status !== 'COMPLETED'
                  ? 'Pending onboarding'
                  : toTitleCase(selectedPractice?.practice_type ?? '')}
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

          <Divider />

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
        </Select>
      </FormControl>

      <AddPracticeDialog open={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </Box>
  )
}
