import { useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useProducts } from 'src/features/products/hooks'
import { useRecordPurchase } from './hooks'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import { paths } from 'src/paths'
import { formatPKR } from 'src/features/subscription/env'
import { Banner, Button, Card, Field, Input, Textarea } from 'src/components/ui'
import { PageHeader } from 'src/components/layout'

type LineState = {
  product_id: string
  qty: string
  cost: string
}

const todayISO = () => new Date().toISOString().slice(0, 10)

export default function NewPurchasePage() {
  const { t, i18n } = useTranslation(['purchases', 'common'])
  const navigate = useNavigate()
  const { data: products, isLoading: productsLoading } = useProducts()
  const record = useRecordPurchase()
  const notify = useNotifier()
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'

  const [purchaseDate, setPurchaseDate] = useState(todayISO())
  const [source, setSource] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<LineState[]>([
    { product_id: '', qty: '1', cost: '0' }
  ])
  const [error, setError] = useState<string | null>(null)

  const total = lines.reduce((s, ln) => {
    const q = Number(ln.qty)
    const c = Number(ln.cost)
    if (Number.isFinite(q) && Number.isFinite(c)) return s + q * c
    return s
  }, 0)

  const updateLine = (i: number, patch: Partial<LineState>) => {
    setLines((prev) =>
      prev.map((ln, idx) => (idx === i ? { ...ln, ...patch } : ln))
    )
  }
  const addLine = () =>
    setLines((prev) => [...prev, { product_id: '', qty: '1', cost: '0' }])
  const removeLine = (i: number) =>
    setLines((prev) => prev.filter((_, idx) => idx !== i))

  const submit = async () => {
    setError(null)

    if (!products || products.length === 0) {
      setError(t('purchases:errors.no_products'))
      return
    }
    if (lines.length === 0) {
      setError(t('purchases:errors.items_required'))
      return
    }
    const items = lines.map((ln) => ({
      product_id: ln.product_id,
      qty: Number(ln.qty),
      cost: Number(ln.cost)
    }))
    for (const it of items) {
      if (!it.product_id) {
        setError(t('purchases:errors.product_required'))
        return
      }
      if (!Number.isFinite(it.qty) || it.qty < 1) {
        setError(t('purchases:errors.qty_invalid'))
        return
      }
      if (!Number.isFinite(it.cost) || it.cost < 0) {
        setError(t('purchases:errors.cost_invalid'))
        return
      }
    }

    try {
      const purchaseId = await record.mutateAsync({
        source,
        note,
        purchase_date: purchaseDate,
        items
      })
      notify.success(t('purchases:messages.saved'))
      navigate(
        purchaseId
          ? paths.gotoPurchase(purchaseId as unknown as string)
          : paths.purchases
      )
    } catch {
      setError(t('purchases:errors.submit_failed'))
    }
  }

  if (!productsLoading && (!products || products.length === 0)) {
    return (
      <Box sx={{ maxWidth: 672, mx: 'auto', width: '100%' }}>
        <PageHeader title={t('purchases:add_purchase')} />
        <Card>
          <Stack spacing={2}>
            <Banner variant='info'>{t('purchases:errors.no_products')}</Banner>
            <Box>
              <Button
                variant='primary'
                onClick={() => navigate(paths.newProduct)}
              >
                {t('purchases:actions.back')}
              </Button>
            </Box>
          </Stack>
        </Card>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 880, mx: 'auto', width: '100%' }}>
      <PageHeader title={t('purchases:add_purchase')} />
      <Card>
        <Stack spacing={2.5}>
          {error && <Banner variant='error'>{error}</Banner>}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Field label={t('purchases:fields.purchase_date')}>
              <Input
                type='date'
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Field>
            <Field label={t('purchases:fields.source')}>
              <Input
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </Field>
          </Stack>

          <Field label={t('purchases:fields.note')}>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              minRows={2}
            />
          </Field>

          <Box>
            <Typography variant='h3' sx={{ mb: 1.5 }}>
              {t('purchases:fields.product')}
            </Typography>
            <Stack spacing={1.5}>
              {lines.map((ln, i) => (
                <Stack
                  key={i}
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ sm: 'center' }}
                >
                  <TextField
                    select
                    label={t('purchases:fields.product')}
                    value={ln.product_id}
                    onChange={(e) =>
                      updateLine(i, { product_id: e.target.value })
                    }
                    fullWidth
                    sx={{ minWidth: 200 }}
                  >
                    {products?.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label={t('purchases:fields.qty')}
                    type='number'
                    inputProps={{ min: 1, step: 1, inputMode: 'numeric' }}
                    value={ln.qty}
                    onChange={(e) => updateLine(i, { qty: e.target.value })}
                    sx={{ width: { xs: '100%', sm: 110 } }}
                  />
                  <TextField
                    label={t('purchases:fields.cost')}
                    type='number'
                    inputProps={{ min: 0, step: '0.01', inputMode: 'numeric' }}
                    value={ln.cost}
                    onChange={(e) => updateLine(i, { cost: e.target.value })}
                    sx={{ width: { xs: '100%', sm: 160 } }}
                  />
                  <IconButton
                    aria-label={t('common:actions.remove', 'Remove')}
                    onClick={() => removeLine(i)}
                    disabled={lines.length === 1}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Stack>
              ))}
              <Button
                variant='ghost'
                size='sm'
                startIcon={<AddIcon />}
                onClick={addLine}
                sx={{ alignSelf: 'flex-start' }}
              >
                {t('purchases:actions.add_line')}
              </Button>
            </Stack>
          </Box>

          <Stack
            direction='row'
            justifyContent='space-between'
            alignItems='center'
            mt={1}
            pt={2}
            sx={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            <Typography variant='body1' sx={{ color: 'var(--text-muted)' }}>
              {t('purchases:fields.total')}
            </Typography>
            <Typography variant='h2' component='span'>
              {formatPKR(total, locale)}
            </Typography>
          </Stack>

          <Stack direction='row' spacing={1.5} justifyContent='flex-end'>
            <Button
              variant='secondary'
              onClick={() => navigate(paths.purchases)}
            >
              {t('purchases:actions.back')}
            </Button>
            <Button
              variant='primary'
              onClick={submit}
              loading={record.isPending}
            >
              {t('purchases:actions.submit')}
            </Button>
          </Stack>
        </Stack>
      </Card>
    </Box>
  )
}
