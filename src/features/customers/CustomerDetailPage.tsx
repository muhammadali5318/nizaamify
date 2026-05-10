import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import PaymentsIcon from '@mui/icons-material/Payments'
import EditIcon from '@mui/icons-material/Edit'
import UndoIcon from '@mui/icons-material/Undo'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { paths } from 'src/paths'
import { useCustomer } from './hooks'
import { useTiers } from 'src/features/tiers/hooks'
import {
  useLedgerEntries,
  type LedgerEntryView
} from 'src/features/khata/hooks'
import ReceivePaymentDialog from 'src/features/khata/ReceivePaymentDialog'
import ReverseEntryDialog from 'src/features/khata/ReverseEntryDialog'
import { formatPKR } from 'src/features/subscription/env'
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  FullPageSpinner,
  Tooltip,
  type DataTableColumn
} from 'src/components/ui'

const truncate = (s: string, n = 60) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s

type LedgerEntryWithBalance = LedgerEntryView & { running_balance: number }

export default function CustomerDetailPage() {
  const { t, i18n } = useTranslation(['customers', 'khata', 'common'])
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'

  const { data: customer, isLoading: loadingCustomer } = useCustomer(id)
  const { data: tiers = [] } = useTiers()
  const tier = customer?.tier_id
    ? tiers.find((tt) => tt.id === customer.tier_id)
    : null
  const { data: entries, isLoading: loadingEntries } = useLedgerEntries(id)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [reverseTarget, setReverseTarget] = useState<LedgerEntryView | null>(
    null
  )

  // Compute running balance for each entry. Entries arrive desc by occurred_at;
  // we walk in chronological order accumulating, then map back.
  const entriesWithBalance: LedgerEntryWithBalance[] = useMemo(() => {
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

  if (loadingCustomer) return <FullPageSpinner />
  if (!customer) return null

  const outstandingAmount = Number(customer.outstanding_balance ?? 0)

  const ledgerColumns: DataTableColumn<LedgerEntryWithBalance>[] = [
    {
      id: 'date',
      header: t('khata:history.date'),
      cardRole: 'heading',
      cell: (e) => (
        <RowText reversed={!!e.reversed_by_entry_id}>
          {new Intl.DateTimeFormat(locale, {
            dateStyle: 'short',
            timeStyle: 'short'
          }).format(new Date(e.occurred_at))}
        </RowText>
      )
    },
    {
      id: 'type',
      header: t('khata:history.type'),
      cell: (e) => {
        const isReversal = !!e.reverses_entry_id
        const isReversed = !!e.reversed_by_entry_id
        return (
          <RowText reversed={isReversed}>
            <Stack direction='row' spacing={0.5} alignItems='center'>
              {e.type === 'debit' ? (
                <Badge variant='warning' label={t('khata:history.debit')} />
              ) : (
                <Badge variant='success' label={t('khata:history.credit')} />
              )}
              {isReversal && (
                <Badge
                  variant='neutral'
                  label={t('khata:entry.reversal_badge')}
                />
              )}
              {isReversed && (
                <Badge
                  variant='neutral'
                  label={t('khata:entry.reversed_badge')}
                />
              )}
            </Stack>
          </RowText>
        )
      }
    },
    {
      id: 'amount',
      header: t('khata:history.amount'),
      align: 'end',
      cell: (e) => {
        const isCredit = e.type === 'credit'
        const amount = Number(e.amount)
        const signed = `${isCredit ? '−' : '+'}${formatPKR(amount, locale)}`
        return (
          <RowText reversed={!!e.reversed_by_entry_id}>
            <Typography
              variant='body1'
              sx={{
                color: isCredit
                  ? 'var(--status-success-text)'
                  : 'var(--warning-700)',
                fontWeight: 600
              }}
            >
              {signed}
            </Typography>
          </RowText>
        )
      }
    },
    {
      id: 'for',
      header: t('khata:history.for'),
      hideOnMobile: true,
      cell: (e) => (
        <RowText reversed={!!e.reversed_by_entry_id}>
          <ForCell
            entry={e}
            onSale={(saleId) => navigate(paths.gotoSale(saleId))}
          />
        </RowText>
      )
    },
    {
      id: 'notes',
      header: t('khata:history.notes'),
      hideOnMobile: true,
      cell: (e) =>
        e.notes ? (
          <Tooltip title={e.notes}>
            <Typography variant='caption'>{truncate(e.notes, 40)}</Typography>
          </Tooltip>
        ) : (
          <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
            —
          </Typography>
        )
    },
    {
      id: 'running',
      header: t('khata:transactions.running_balance'),
      align: 'end',
      cell: (e) => (
        <RowText reversed={!!e.reversed_by_entry_id}>
          {formatPKR(e.running_balance, locale)}
        </RowText>
      )
    },
    {
      id: 'actions',
      header: t('khata:history.actions'),
      align: 'end',
      width: 56,
      cardRole: 'actions',
      cell: (e) => {
        const isReversal = !!e.reverses_entry_id
        const isReversed = !!e.reversed_by_entry_id
        if (isReversal || isReversed) return null
        return (
          <Tooltip title={t('khata:entry.reverse_action')}>
            <IconButton
              size='small'
              onClick={() => setReverseTarget(e)}
              aria-label={t('khata:entry.reverse_action')}
            >
              <UndoIcon fontSize='small' />
            </IconButton>
          </Tooltip>
        )
      }
    }
  ]

  return (
    <Box sx={{ maxWidth: 1024, mx: 'auto', width: '100%' }}>
      <Button
        variant='ghost'
        onClick={() => navigate(paths.khata)}
        sx={{ mb: 1 }}
      >
        {t('customers:actions.back')}
      </Button>

      <Card sx={{ mb: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent='space-between'
          alignItems={{ sm: 'center' }}
          spacing={2}
        >
          <Box>
            <Typography variant='display' component='h1'>
              {customer.name}
            </Typography>
            <Stack
              direction='row'
              spacing={1}
              alignItems='center'
              flexWrap='wrap'
            >
              <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
                {customer.phone}
              </Typography>
              {tier && (
                <Badge
                  variant='info'
                  label={t('customers:tier_chip_label', {
                    name: tier.name,
                    percent: tier.discount_percent
                  })}
                />
              )}
            </Stack>
          </Box>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems={{ sm: 'center' }}
          >
            <Box>
              <Typography
                variant='overline'
                sx={{ color: 'var(--text-muted)', display: 'block' }}
              >
                {t('khata:fields.outstanding')}
              </Typography>
              <Typography
                variant='h2'
                component='span'
                sx={{
                  fontWeight: 700,
                  color:
                    outstandingAmount > 0
                      ? 'var(--warning-700)'
                      : outstandingAmount < 0
                        ? 'var(--error-700)'
                        : 'var(--status-success-text)'
                }}
              >
                {formatPKR(outstandingAmount, locale)}
              </Typography>
            </Box>
            <Stack direction='row' spacing={1}>
              <Button
                variant='secondary'
                startIcon={<EditIcon />}
                onClick={() => navigate(paths.gotoCustomerEdit(customer.id))}
              >
                {t('customers:actions.edit')}
              </Button>
              <Button
                variant='primary'
                startIcon={<PaymentsIcon />}
                disabled={outstandingAmount <= 0}
                onClick={() => setPaymentOpen(true)}
              >
                {t('khata:receive_payment.open')}
              </Button>
            </Stack>
          </Stack>
        </Stack>

        {(customer.address || customer.notes) && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={3}
            mt={2}
            pt={2}
            sx={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            {customer.address && (
              <Box sx={{ flex: 1 }}>
                <Typography
                  variant='overline'
                  sx={{ color: 'var(--text-muted)' }}
                >
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
                <Typography
                  variant='overline'
                  sx={{ color: 'var(--text-muted)' }}
                >
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
      </Card>

      <Card noPadding>
        <Box sx={{ p: 2, borderBottom: '1px solid var(--border-subtle)' }}>
          <Typography variant='h3'>{t('khata:history.title')}</Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          <DataTable
            columns={ledgerColumns}
            rows={entriesWithBalance}
            getRowId={(e) => e.id}
            loading={loadingEntries}
            empty={
              <Box sx={{ py: 4 }}>
                <EmptyState title={t('khata:history.empty')} />
              </Box>
            }
            ariaLabel={t('khata:history.title')}
          />
        </Box>
      </Card>

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

/**
 * Wraps any cell content with the strikethrough+dimmed styling used for
 * reversed ledger entries. DataTable doesn't support row-level styling
 * besides the active marker, so we apply it cell by cell.
 */
function RowText({
  reversed,
  children
}: {
  reversed: boolean
  children: React.ReactNode
}) {
  if (!reversed) return <>{children}</>
  return (
    <Box
      component='span'
      sx={{ textDecoration: 'line-through', opacity: 0.55 }}
    >
      {children}
    </Box>
  )
}

function ForCell({
  entry,
  onSale
}: {
  entry: LedgerEntryView
  onSale: (saleId: string) => void
}) {
  const { t } = useTranslation(['khata'])
  const isCredit = entry.type === 'credit'

  // Traditional khata: credits are customer-level only.
  if (isCredit) {
    return (
      <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
        {t('khata:entry.payment_received')}
      </Typography>
    )
  }
  // Debit, has products
  if (entry.invoice_id && entry.items_count && entry.items_count > 0) {
    return (
      <Stack spacing={0.25}>
        <Typography variant='caption'>
          {entry.products_summary ?? ''}
        </Typography>
        <Button
          variant='link'
          size='sm'
          onClick={() => onSale(entry.invoice_id as string)}
        >
          #{entry.invoice_id.slice(0, 8)}
        </Button>
      </Stack>
    )
  }
  // Debit, service-only
  if (entry.invoice_id) {
    return (
      <Stack spacing={0.25}>
        <Stack direction='row' spacing={0.5} alignItems='center'>
          <Badge variant='info' label={t('khata:entry.service')} />
          {entry.invoice_notes && (
            <Tooltip title={entry.invoice_notes}>
              <Typography variant='caption'>
                {truncate(entry.invoice_notes, 40)}
              </Typography>
            </Tooltip>
          )}
        </Stack>
        <Button
          variant='link'
          size='sm'
          onClick={() => onSale(entry.invoice_id as string)}
        >
          #{entry.invoice_id.slice(0, 8)}
        </Button>
      </Stack>
    )
  }
  return (
    <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
      —
    </Typography>
  )
}
