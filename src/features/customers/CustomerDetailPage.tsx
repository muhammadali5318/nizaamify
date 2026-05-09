import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography
} from '@mui/material'
import PaymentsIcon from '@mui/icons-material/Payments'
import EditIcon from '@mui/icons-material/Edit'
import UndoIcon from '@mui/icons-material/Undo'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { paths } from 'src/paths'
import { useCustomer } from './hooks'
import {
  useLedgerEntries,
  type LedgerEntryView
} from 'src/features/khata/hooks'
import ReceivePaymentDialog from 'src/features/khata/ReceivePaymentDialog'
import ReverseEntryDialog from 'src/features/khata/ReverseEntryDialog'
import { formatPKR } from 'src/features/subscription/env'

const truncate = (s: string, n = 60) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s

export default function CustomerDetailPage() {
  const { t, i18n } = useTranslation(['customers', 'khata', 'common'])
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'

  const { data: customer, isLoading: loadingCustomer } = useCustomer(id)
  const { data: entries, isLoading: loadingEntries } = useLedgerEntries(id)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [reverseTarget, setReverseTarget] = useState<LedgerEntryView | null>(
    null
  )

  // Compute running balance for each entry. Entries arrive desc by occurred_at;
  // we walk in chronological order accumulating, then map back.
  const entriesWithBalance = useMemo(() => {
    if (!entries) return []
    const chrono = [...entries].sort(
      (a, b) =>
        new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    )
    let balance = 0
    const balances = new Map<string, number>()
    for (const e of chrono) {
      balance += e.type === 'debit' ? Number(e.amount) : -Number(e.amount)
      balances.set(e.id, balance)
    }
    return entries.map((e) => ({
      ...e,
      running_balance: balances.get(e.id) ?? 0
    }))
  }, [entries])

  if (loadingCustomer) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress size={24} />
      </Box>
    )
  }

  if (!customer) return null

  const outstandingAmount = Number(customer.outstanding_balance ?? 0)

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Button onClick={() => navigate(paths.khata)} sx={{ mb: 1 }}>
        {t('customers:actions.back')}
      </Button>

      <Paper sx={{ p: 3, borderRadius: 3, mb: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent='space-between'
          alignItems={{ sm: 'center' }}
          spacing={2}
        >
          <Box>
            <Typography variant='h5' fontWeight={700}>
              {customer.name}
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              {customer.phone}
            </Typography>
          </Box>
          <Stack direction='row' spacing={2} alignItems='center'>
            <Box>
              <Typography variant='caption' color='text.secondary'>
                {t('khata:fields.outstanding')}
              </Typography>
              <Typography
                variant='h6'
                fontWeight={700}
                color={
                  outstandingAmount > 0
                    ? 'warning.main'
                    : outstandingAmount < 0
                      ? 'error.main'
                      : 'success.main'
                }
              >
                {formatPKR(outstandingAmount, locale)}
              </Typography>
            </Box>
            <Button
              variant='outlined'
              startIcon={<EditIcon />}
              onClick={() => navigate(paths.gotoCustomerEdit(customer.id))}
            >
              {t('customers:actions.edit')}
            </Button>
            <Button
              variant='contained'
              startIcon={<PaymentsIcon />}
              disabled={outstandingAmount <= 0}
              onClick={() => setPaymentOpen(true)}
            >
              {t('khata:receive_payment.open')}
            </Button>
          </Stack>
        </Stack>

        {(customer.address || customer.notes) && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={3}
            mt={2}
            pt={2}
            sx={{ borderTop: 1, borderColor: 'divider' }}
          >
            {customer.address && (
              <Box sx={{ flex: 1 }}>
                <Typography variant='caption' color='text.secondary'>
                  {t('customers:fields.address')}
                </Typography>
                <Typography
                  variant='body2'
                  sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}
                >
                  {customer.address}
                </Typography>
              </Box>
            )}
            {customer.notes && (
              <Box sx={{ flex: 1 }}>
                <Typography variant='caption' color='text.secondary'>
                  {t('customers:fields.notes')}
                </Typography>
                <Typography
                  variant='body2'
                  sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}
                >
                  {customer.notes}
                </Typography>
              </Box>
            )}
          </Stack>
        )}
      </Paper>

      <Paper variant='outlined' sx={{ borderRadius: 2 }}>
        <Box sx={{ p: 2 }}>
          <Typography variant='subtitle1' fontWeight={700}>
            {t('khata:history.title')}
          </Typography>
        </Box>
        {loadingEntries ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : entriesWithBalance.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant='body2' color='text.secondary'>
              {t('khata:history.empty')}
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>{t('khata:history.date')}</TableCell>
                  <TableCell>{t('khata:history.type')}</TableCell>
                  <TableCell align='right'>
                    {t('khata:history.amount')}
                  </TableCell>
                  <TableCell>{t('khata:history.for')}</TableCell>
                  <TableCell>{t('khata:history.notes')}</TableCell>
                  <TableCell align='right'>
                    {t('khata:transactions.running_balance')}
                  </TableCell>
                  <TableCell align='right'>
                    {t('khata:history.actions')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entriesWithBalance.map((e) => {
                  const isReversal = !!e.reverses_entry_id
                  const isReversed = !!e.reversed_by_entry_id
                  const isCredit = e.type === 'credit'
                  const amount = Number(e.amount)
                  const signed = `${isCredit ? '−' : '+'}${formatPKR(
                    amount,
                    locale
                  )}`

                  const forCell = (() => {
                    // Traditional khata: credits are customer-level only.
                    // The "for" cell on a credit just labels it as a payment;
                    // any context lives in the notes column.
                    if (isCredit) {
                      return (
                        <Typography variant='caption' color='text.secondary'>
                          {t('khata:entry.payment_received')}
                        </Typography>
                      )
                    }
                    // Debit, has products
                    if (e.invoice_id && e.items_count && e.items_count > 0) {
                      return (
                        <Stack spacing={0.25}>
                          <Typography variant='caption'>
                            {e.products_summary ?? ''}
                          </Typography>
                          <Button
                            size='small'
                            sx={{ p: 0, minWidth: 0 }}
                            onClick={() =>
                              navigate(paths.gotoSale(e.invoice_id as string))
                            }
                          >
                            #{e.invoice_id.slice(0, 8)}
                          </Button>
                        </Stack>
                      )
                    }
                    // Debit, service-only
                    if (e.invoice_id) {
                      return (
                        <Stack spacing={0.25}>
                          <Stack
                            direction='row'
                            spacing={0.5}
                            alignItems='center'
                          >
                            <Chip
                              label={t('khata:entry.service')}
                              size='small'
                              color='info'
                              variant='outlined'
                              sx={{ height: 18, fontSize: 10 }}
                            />
                            {e.invoice_notes && (
                              <Tooltip title={e.invoice_notes}>
                                <Typography variant='caption'>
                                  {truncate(e.invoice_notes, 40)}
                                </Typography>
                              </Tooltip>
                            )}
                          </Stack>
                          <Button
                            size='small'
                            sx={{ p: 0, minWidth: 0 }}
                            onClick={() =>
                              navigate(paths.gotoSale(e.invoice_id as string))
                            }
                          >
                            #{e.invoice_id.slice(0, 8)}
                          </Button>
                        </Stack>
                      )
                    }
                    return (
                      <Typography variant='caption' color='text.secondary'>
                        —
                      </Typography>
                    )
                  })()

                  return (
                    <TableRow
                      key={e.id}
                      hover
                      sx={{
                        opacity: isReversed ? 0.55 : 1,
                        '& > *': isReversed
                          ? { textDecoration: 'line-through' }
                          : {}
                      }}
                    >
                      <TableCell>
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: 'short',
                          timeStyle: 'short'
                        }).format(new Date(e.occurred_at))}
                      </TableCell>
                      <TableCell>
                        <Stack
                          direction='row'
                          spacing={0.5}
                          alignItems='center'
                        >
                          {e.type === 'debit' ? (
                            <Chip
                              size='small'
                              label={t('khata:history.debit')}
                              color='warning'
                            />
                          ) : (
                            <Chip
                              size='small'
                              label={t('khata:history.credit')}
                              color='success'
                            />
                          )}
                          {isReversal && (
                            <Chip
                              size='small'
                              variant='outlined'
                              color='default'
                              label={t('khata:entry.reversal_badge')}
                              sx={{ height: 18, fontSize: 10 }}
                            />
                          )}
                          {isReversed && (
                            <Chip
                              size='small'
                              variant='outlined'
                              color='default'
                              label={t('khata:entry.reversed_badge')}
                              sx={{ height: 18, fontSize: 10 }}
                            />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align='right'>
                        <Typography
                          variant='body2'
                          color={isCredit ? 'success.main' : 'warning.main'}
                          fontWeight={600}
                        >
                          {signed}
                        </Typography>
                      </TableCell>
                      <TableCell>{forCell}</TableCell>
                      <TableCell>
                        {e.notes ? (
                          <Tooltip title={e.notes}>
                            <Typography variant='caption'>
                              {truncate(e.notes, 40)}
                            </Typography>
                          </Tooltip>
                        ) : (
                          <Typography variant='caption' color='text.secondary'>
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align='right'>
                        {formatPKR(e.running_balance, locale)}
                      </TableCell>
                      <TableCell align='right'>
                        {!isReversal && !isReversed && (
                          <Tooltip title={t('khata:entry.reverse_action')}>
                            <IconButton
                              size='small'
                              onClick={() => setReverseTarget(e)}
                              aria-label={t('khata:entry.reverse_action')}
                            >
                              <UndoIcon fontSize='small' />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <ReceivePaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        customerId={customer.id}
        customerName={customer.name}
        outstanding={outstandingAmount}
      />
      <ReverseEntryDialog
        open={!!reverseTarget}
        onClose={() => setReverseTarget(null)}
        entry={reverseTarget}
      />
    </Box>
  )
}
