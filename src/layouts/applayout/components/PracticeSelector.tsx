import VerifiedIcon from '@mui/icons-material/Verified'
import Box from '@mui/material/Box'
import { FormControl, MenuItem, Select, Stack, Typography } from '@mui/material'
import { useMemo, useState } from 'react'
import styles from '../AppLayout.module.scss'

type PracticeOption = {
  id: string
  practiceName: string
  subLabel: string
  verified?: boolean
}

const PRACTICES: PracticeOption[] = [
  {
    id: 'starter-practice',
    practiceName: 'Starter Practice',
    subLabel: 'Primary workspace',
    verified: true
  },
  {
    id: 'growth-practice',
    practiceName: 'Growth Practice',
    subLabel: 'Secondary workspace'
  }
]

export default function PracticeSelector() {
  const [selectedPracticeId, setSelectedPracticeId] = useState(() => {
    if (typeof window === 'undefined') {
      return PRACTICES[0].id
    }

    return localStorage.getItem('templatePracticeId') ?? PRACTICES[0].id
  })

  const selectedPractice = useMemo(
    () =>
      PRACTICES.find((practice) => practice.id === selectedPracticeId) ??
      PRACTICES[0],
    [selectedPracticeId]
  )

  return (
    <Box
      className={styles.practiceSelector}
      sx={{ display: 'flex', alignItems: 'center' }}
    >
      <img src='/assets/practice-selector.svg' alt='practice selector' />

      <FormControl className={styles.muiSelectForm} fullWidth>
        <Select
          value={selectedPractice.id}
          SelectDisplayProps={{
            style: {
              display: 'flex',
              alignItems: 'center',
              overflow: 'hidden'
            }
          }}
          MenuProps={{ disablePortal: false }}
          onChange={(event) => {
            const nextPracticeId = event.target.value
            setSelectedPracticeId(nextPracticeId)
            localStorage.setItem('templatePracticeId', nextPracticeId)
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
              <Box display='flex' gap={1} alignItems='center'>
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
                  {selectedPractice.practiceName}
                </Typography>
                {selectedPractice.verified && (
                  <VerifiedIcon sx={{ fontSize: 16 }} />
                )}
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
                color='success.light'
                fontWeight={700}
                fontStyle='italic'
              >
                {selectedPractice.subLabel}
              </Typography>
            </Stack>
          )}
        >
          {PRACTICES.map((practice) => (
            <MenuItem key={practice.id} value={practice.id}>
              <Stack direction='column' spacing={0.25}>
                <Typography variant='subtitle2' fontWeight={700}>
                  {practice.practiceName}
                </Typography>
                <Typography variant='caption' color='text.secondary'>
                  {practice.subLabel}
                </Typography>
              </Stack>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  )
}
