import {
  Box,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Button
} from '@mui/material'
import { useState } from 'react'
import apiClient from '../../../services/api-client'
import { notify } from 'src/components/notistack/NotificationProvider'
import { useActivePractice } from 'src/hooks/useActivePractice'
import useUserDetails from 'src/hooks/useUserDetails'

const reasons = [
  'Too expensive',
  'Not using the service',
  'Switching to a competitor',
  'Temporary pause',
  'Other'
]

export const Step2 = ({ goBack, close }: any) => {
  const { activePractice } = useActivePractice()
  const practiceId = activePractice?.id
  const { email } = useUserDetails()
  const currentUserEmail = email

  const [selected, setSelected] = useState('')
  const [otherReason, setOtherReason] = useState('')
  const [loading, setLoading] = useState(false)

  const submitCancellation = async () => {
    const payload = {
      email: '',
      cancellation_reason:
        selected === 'Other' ? ['other', otherReason] : [selected]
    }

    try {
      setLoading(true)
      const res = await apiClient.put(
        `/subscription/v1/practices/${practiceId}/cancel/`,
        payload
      )
      notify.success(res?.data?.message)
      close()
    } catch (err: any) {
      console.error(err?.message)
      notify.error(err?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box>
      <Typography variant='h6'>Reason for cancellation</Typography>
      <Box>
        <ul>
          <li>
            Your access will remain active until{' '}
            <strong>28/11/2025.</strong>{' '}
          </li>
          <li>You’ll continue to enjoy all paid features until that date.</li>

          <li>
            Afterward, your account will switch to read-only mode, and billing
            will automatically stop.
          </li>
        </ul>
      </Box>
      <Typography variant='h6'>Will you help us learn why?</Typography>

      <RadioGroup
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        {reasons.map((r) => (
          <FormControlLabel key={r} value={r} control={<Radio />} label={r} />
        ))}
      </RadioGroup>

      {selected === 'Other' && (
        <TextField
          fullWidth
          multiline
          rows={3}
          placeholder='Please describe your reason'
          value={otherReason}
          onChange={(e) => setOtherReason(e.target.value)}
          sx={{ mt: 2 }}
        />
      )}

      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button variant='outlined' onClick={goBack} fullWidth>
          Back
        </Button>

        <Button
          variant='contained'
          sx={{ backgroundColor: '#D32F2F' }}
          fullWidth
          disabled={!selected || (selected === 'Other' && !otherReason)}
          onClick={submitCancellation}
        >
          {loading ? 'Processing...' : 'Cancel Subscription'}
        </Button>
      </Box>
    </Box>
  )
}
