import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { currentMonthISO, useTargetForMonth, useUpsertTarget } from './hooks'
import { useNotifier } from 'src/components/notistack/NotificationProvider'

export default function TargetsPage() {
  const { t } = useTranslation(['targets', 'common'])
  const month = currentMonthISO()
  const { data, isLoading } = useTargetForMonth(month)
  const upsert = useUpsertTarget()
  const notify = useNotifier()

  const [sale, setSale] = useState('0')
  const [gross, setGross] = useState('0')
  const [net, setNet] = useState('0')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (data) {
      setSale(String(data.target_sale))
      setGross(String(data.target_gross_profit))
      setNet(String(data.target_net_profit))
    }
  }, [data])

  const submit = async () => {
    setError(null)
    try {
      await upsert.mutateAsync({
        month,
        target_sale: Number(sale) || 0,
        target_gross_profit: Number(gross) || 0,
        target_net_profit: Number(net) || 0
      })
      notify.success(t('targets:messages.saved'))
    } catch {
      setError(t('targets:errors.save_failed'))
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress size={24} />
      </Box>
    )
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Paper sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3, maxWidth: 720 }}>
        <Stack mb={3}>
          <Typography variant='h5' fontWeight={700}>
            {t('targets:title')}
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            {t('targets:subtitle')}
          </Typography>
        </Stack>

        <Stack spacing={2}>
          {error && <Alert severity='error'>{error}</Alert>}

          <TextField
            label={t('targets:fields.month')}
            value={month}
            disabled
            fullWidth
          />
          <TextField
            label={t('targets:fields.target_sale')}
            type='number'
            inputProps={{ min: 0, step: '0.01' }}
            value={sale}
            onChange={(e) => setSale(e.target.value)}
            fullWidth
          />
          <TextField
            label={t('targets:fields.target_gross_profit')}
            type='number'
            inputProps={{ min: 0, step: '0.01' }}
            value={gross}
            onChange={(e) => setGross(e.target.value)}
            fullWidth
          />
          <TextField
            label={t('targets:fields.target_net_profit')}
            type='number'
            inputProps={{ min: 0, step: '0.01' }}
            value={net}
            onChange={(e) => setNet(e.target.value)}
            fullWidth
          />
          <Stack direction='row' justifyContent='flex-end'>
            <Button
              variant='contained'
              onClick={submit}
              disabled={upsert.isPending}
            >
              {t('targets:actions.save')}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  )
}
