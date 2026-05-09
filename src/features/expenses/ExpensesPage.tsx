import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { useTranslation } from 'react-i18next'
import { EXPENSE_CATEGORIES, useCreateExpense, useExpenses } from './hooks'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import { formatPKR } from 'src/features/subscription/env'

const todayISO = () => new Date().toISOString().slice(0, 10)

export default function ExpensesPage() {
  const { t, i18n } = useTranslation(['expenses', 'common'])
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  const { data, isLoading } = useExpenses()
  const create = useCreateExpense()
  const notify = useNotifier()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('rent')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) {
      setError(t('expenses:errors.amount_invalid'))
      return
    }
    try {
      await create.mutateAsync({
        category,
        amount: n,
        expense_date: date,
        note: note.trim() || null
      })
      notify.success(t('expenses:messages.saved'))
      setOpen(false)
      setAmount('')
      setNote('')
      setCategory('rent')
      setDate(todayISO())
    } catch {
      setError(t('expenses:errors.save_failed'))
    }
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack
        direction='row'
        alignItems='center'
        justifyContent='space-between'
        mb={2}
      >
        <Typography variant='h5' fontWeight={700}>
          {t('expenses:title')}
        </Typography>
        <Button
          variant='contained'
          startIcon={<AddIcon />}
          onClick={() => setOpen(true)}
        >
          {t('expenses:add')}
        </Button>
      </Stack>

      <Paper variant='outlined' sx={{ borderRadius: 2 }}>
        {isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : !data || data.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant='body2' color='text.secondary'>
              {t('expenses:empty')}
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('expenses:fields.expense_date')}</TableCell>
                  <TableCell>{t('expenses:fields.category')}</TableCell>
                  <TableCell>{t('expenses:fields.note')}</TableCell>
                  <TableCell align='right'>
                    {t('expenses:fields.amount')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      {new Intl.DateTimeFormat(locale, {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      }).format(new Date(e.expense_date))}
                    </TableCell>
                    <TableCell>
                      {t(`expenses:categories.${e.category}`, {
                        defaultValue: e.category
                      })}
                    </TableCell>
                    <TableCell>{e.note ?? ''}</TableCell>
                    <TableCell align='right'>
                      {formatPKR(e.amount, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth='xs'
      >
        <DialogTitle>{t('expenses:add')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {error && <Alert severity='error'>{error}</Alert>}
            <TextField
              select
              label={t('expenses:fields.category')}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              fullWidth
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>
                  {t(`expenses:categories.${c}`)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('expenses:fields.amount')}
              type='number'
              inputProps={{ min: 0, step: '0.01' }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('expenses:fields.expense_date')}
              type='date'
              value={date}
              onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label={t('expenses:fields.note')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              multiline
              minRows={2}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant='contained'
            onClick={submit}
            disabled={create.isPending}
          >
            {t('expenses:actions.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
