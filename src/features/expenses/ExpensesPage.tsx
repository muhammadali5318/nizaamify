import { useState } from 'react'
import Box from '@mui/material/Box'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import AddIcon from '@mui/icons-material/Add'
import { useTranslation } from 'react-i18next'
import {
  EXPENSE_CATEGORIES,
  useCreateExpense,
  useExpenses,
  type Expense
} from './hooks'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import { formatPKR } from 'src/features/subscription/env'
import {
  Banner,
  Button,
  DataTable,
  Dialog,
  EmptyState,
  Field,
  Input,
  Textarea,
  type DataTableColumn
} from 'src/components/ui'
import { PageHeader } from 'src/components/layout'
import { PermissionGated } from 'src/components/ui/PermissionGated'

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

  const rows = data ?? []

  const columns: DataTableColumn<Expense>[] = [
    {
      id: 'date',
      header: t('expenses:fields.expense_date'),
      cardRole: 'heading',
      cell: (e) =>
        new Intl.DateTimeFormat(locale, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }).format(new Date(e.expense_date))
    },
    {
      id: 'category',
      header: t('expenses:fields.category'),
      cell: (e) =>
        t(`expenses:categories.${e.category}`, { defaultValue: e.category })
    },
    {
      id: 'note',
      header: t('expenses:fields.note'),
      hideOnMobile: true,
      cell: (e) => e.note ?? ''
    },
    {
      id: 'amount',
      header: t('expenses:fields.amount'),
      align: 'end',
      cell: (e) => (
        <Box component='span' sx={{ fontWeight: 600 }}>
          {formatPKR(e.amount, locale)}
        </Box>
      )
    }
  ]

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', width: '100%' }}>
      <PageHeader
        title={t('expenses:title')}
        actions={
          <PermissionGated permission='create_expense'>
            <Button
              variant='primary'
              startIcon={<AddIcon />}
              onClick={() => setOpen(true)}
            >
              {t('expenses:add')}
            </Button>
          </PermissionGated>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(e) => e.id}
        loading={isLoading}
        empty={
          <Box sx={{ py: 4 }}>
            <EmptyState title={t('expenses:empty')} />
          </Box>
        }
        ariaLabel={t('expenses:title')}
      />

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('expenses:add')}
        actions={
          <>
            <Button variant='ghost' onClick={() => setOpen(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button
              variant='primary'
              onClick={submit}
              loading={create.isPending}
            >
              {t('expenses:actions.save')}
            </Button>
          </>
        }
      >
        <Stack spacing={2.5} mt={1}>
          {error && <Banner variant='error'>{error}</Banner>}

          <Field label={t('expenses:fields.category')}>
            <TextField
              select
              fullWidth
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>
                  {t(`expenses:categories.${c}`)}
                </MenuItem>
              ))}
            </TextField>
          </Field>

          <Field label={t('expenses:fields.amount')}>
            <Input
              type='number'
              inputProps={{ min: 0, step: '0.01', inputMode: 'numeric' }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>

          <Field label={t('expenses:fields.expense_date')}>
            <Input
              type='date'
              value={date}
              onChange={(e) => setDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Field>

          <Field label={t('expenses:fields.note')}>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              minRows={2}
            />
          </Field>
        </Stack>
      </Dialog>
    </Box>
  )
}
