import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import { useTranslation } from 'react-i18next'
import { currentMonthISO, useTargetForMonth, useUpsertTarget } from './hooks'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import {
  Banner,
  Button,
  Card,
  Field,
  FullPageSpinner,
  Input
} from 'src/components/ui'
import { PageHeader } from 'src/components/layout'

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

  if (isLoading) return <FullPageSpinner />

  return (
    <Box sx={{ maxWidth: 672, mx: 'auto', width: '100%' }}>
      <PageHeader title={t('targets:title')} subtitle={t('targets:subtitle')} />

      <Card>
        <Stack spacing={2.5}>
          {error && <Banner variant='error'>{error}</Banner>}

          <Field label={t('targets:fields.month')}>
            <Input value={month} disabled />
          </Field>
          <Field label={t('targets:fields.target_sale')}>
            <Input
              type='number'
              inputProps={{ min: 0, step: '0.01', inputMode: 'numeric' }}
              value={sale}
              onChange={(e) => setSale(e.target.value)}
            />
          </Field>
          <Field label={t('targets:fields.target_gross_profit')}>
            <Input
              type='number'
              inputProps={{ min: 0, step: '0.01', inputMode: 'numeric' }}
              value={gross}
              onChange={(e) => setGross(e.target.value)}
            />
          </Field>
          <Field label={t('targets:fields.target_net_profit')}>
            <Input
              type='number'
              inputProps={{ min: 0, step: '0.01', inputMode: 'numeric' }}
              value={net}
              onChange={(e) => setNet(e.target.value)}
            />
          </Field>

          <Stack direction='row' justifyContent='flex-end'>
            <Button
              variant='primary'
              onClick={submit}
              loading={upsert.isPending}
            >
              {t('targets:actions.save')}
            </Button>
          </Stack>
        </Stack>
      </Card>
    </Box>
  )
}
