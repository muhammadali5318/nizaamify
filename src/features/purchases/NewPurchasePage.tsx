import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useProducts } from 'src/features/products/hooks'
import { useRecordPurchase } from './hooks'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import { paths } from 'src/paths'
import { formatPKR } from 'src/features/subscription/env'

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
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Paper sx={{ p: 4, borderRadius: 3, maxWidth: 640 }}>
          <Typography variant='h6' fontWeight={700} mb={1}>
            {t('purchases:add_purchase')}
          </Typography>
          <Alert severity='info' sx={{ mb: 2 }}>
            {t('purchases:errors.no_products')}
          </Alert>
          <Button
            onClick={() => navigate(paths.newProduct)}
            variant='contained'
          >
            {t('purchases:actions.back')}
          </Button>
        </Paper>
      </Box>
    )
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Paper sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3, maxWidth: 880 }}>
        <Typography variant='h5' fontWeight={700} mb={3}>
          {t('purchases:add_purchase')}
        </Typography>

        <Stack spacing={2}>
          {error && <Alert severity='error'>{error}</Alert>}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label={t('purchases:fields.purchase_date')}
              type='date'
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label={t('purchases:fields.source')}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              fullWidth
            />
          </Stack>

          <TextField
            label={t('purchases:fields.note')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />

          <Box>
            <Typography variant='subtitle1' fontWeight={700} mb={1}>
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
                    inputProps={{ min: 1, step: 1 }}
                    value={ln.qty}
                    onChange={(e) => updateLine(i, { qty: e.target.value })}
                    sx={{ width: { xs: '100%', sm: 110 } }}
                  />
                  <TextField
                    label={t('purchases:fields.cost')}
                    type='number'
                    inputProps={{ min: 0, step: '0.01' }}
                    value={ln.cost}
                    onChange={(e) => updateLine(i, { cost: e.target.value })}
                    sx={{ width: { xs: '100%', sm: 160 } }}
                  />
                  <IconButton
                    aria-label='remove'
                    onClick={() => removeLine(i)}
                    disabled={lines.length === 1}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Stack>
              ))}
              <Button
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
          >
            <Typography variant='body2' color='text.secondary'>
              {t('purchases:fields.total')}
            </Typography>
            <Typography variant='h6' fontWeight={700}>
              {formatPKR(total, locale)}
            </Typography>
          </Stack>

          <Stack direction='row' spacing={1} justifyContent='flex-end'>
            <Button
              variant='outlined'
              onClick={() => navigate(paths.purchases)}
            >
              {t('purchases:actions.back')}
            </Button>
            <Button
              variant='contained'
              onClick={submit}
              disabled={record.isPending}
            >
              {t('purchases:actions.submit')}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  )
}
