import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { paths } from 'src/paths'
import {
  Button,
  DataTable,
  EmptyState,
  Pagination,
  Tooltip,
  type DataTableColumn
} from 'src/components/ui'
import { PageHeader } from 'src/components/layout'
import { PermissionGated } from 'src/components/ui/PermissionGated'
import { formatPKR } from 'src/features/subscription/env'
import SupplierCombobox from 'src/features/suppliers/SupplierCombobox'
import { usePermission } from 'src/lib/permissions'
import { useSearchPurchases, type PurchaseListRow } from './hooks'

const PAGE_SIZE = 10

type Preset = 'mtd' | 'last_30' | 'last_90' | 'this_year' | 'custom'

const todayISO = () => new Date().toISOString().slice(0, 10)
const isoFrom = (d: Date) => d.toISOString().slice(0, 10)
const startOfMonth = () => {
  const now = new Date()
  return isoFrom(new Date(now.getFullYear(), now.getMonth(), 1))
}
const startOfYear = () => {
  const now = new Date()
  return isoFrom(new Date(now.getFullYear(), 0, 1))
}
const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return isoFrom(d)
}

const presetRange = (p: Preset): { from: string; to: string } | null => {
  const to = todayISO()
  if (p === 'mtd') return { from: startOfMonth(), to }
  if (p === 'last_30') return { from: daysAgo(30), to }
  if (p === 'last_90') return { from: daysAgo(90), to }
  if (p === 'this_year') return { from: startOfYear(), to }
  return null
}

const truncate = (s: string, n = 40) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s

export default function PurchasesListPage() {
  const { t, i18n } = useTranslation(['purchases', 'common'])
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // v2.9.1: route already gated on view_purchases (owner+manager). Inside,
  // cost-specific columns (items_subtotal, overhead, total_cost) gate on
  // view_product_cost — handles override-revoked users.
  const canViewProductCost = usePermission('view_product_cost')

  // URL-driven state
  const initialPreset = (searchParams.get('preset') as Preset | null) ?? 'mtd'
  const initialFrom = searchParams.get('from') ?? presetRange('mtd')!.from
  const initialTo = searchParams.get('to') ?? presetRange('mtd')!.to
  const initialSupplier = searchParams.get('supplier_id')
  const initialIncludeOpening = searchParams.get('include_opening') === '1'
  const initialPage = Math.max(0, Number(searchParams.get('page') ?? 1) - 1)

  const [preset, setPreset] = useState<Preset>(initialPreset)
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [supplierId, setSupplierId] = useState<string | null>(initialSupplier)
  const [includeOpening, setIncludeOpening] = useState(initialIncludeOpening)
  const [page, setPage] = useState(initialPage)

  // When preset changes, snap from/to (except 'custom' which keeps user values)
  useEffect(() => {
    if (preset === 'custom') return
    const r = presetRange(preset)
    if (r) {
      setFrom(r.from)
      setTo(r.to)
    }
  }, [preset])

  // Persist filters to URL
  useEffect(() => {
    const params = new URLSearchParams()
    params.set('preset', preset)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (supplierId) params.set('supplier_id', supplierId)
    if (includeOpening) params.set('include_opening', '1')
    if (page > 0) params.set('page', String(page + 1))
    setSearchParams(params, { replace: true })
  }, [preset, from, to, supplierId, includeOpening, page, setSearchParams])

  // Reset to page 0 on filter change
  useEffect(() => {
    setPage(0)
  }, [from, to, supplierId, includeOpening])

  const { data, isLoading } = useSearchPurchases({
    from,
    to,
    supplierId,
    includeOpening,
    page,
    pageSize: PAGE_SIZE
  })
  const rows = data?.rows ?? []
  const total = data?.total ?? 0

  const startSerial = page * PAGE_SIZE
  // DataTable's cell signature is (row) → ReactNode (no index). Precompute
  // the serial per row.id so we can render `# row N + page offset` correctly.
  // Rendering with `(_p, idx) => idx + 1` would resolve to NaN.
  const serialById = useMemo(
    () => new Map(rows.map((r, i) => [r.id, startSerial + i + 1])),
    [rows, startSerial]
  )

  const columns: DataTableColumn<PurchaseListRow>[] = useMemo(
    () => [
      {
        id: 'serial',
        header: '#',
        width: 48,
        cell: (p) => (
          <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
            {serialById.get(p.id) ?? ''}
          </Typography>
        )
      },
      {
        id: 'date',
        header: t('purchases:list.columns.date'),
        cardRole: 'heading',
        cell: (p) =>
          new Intl.DateTimeFormat(locale, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }).format(new Date(p.purchase_date))
      },
      {
        id: 'supplier',
        header: t('purchases:list.columns.supplier'),
        cell: (p) =>
          p.supplier_name ??
          p.source ?? (
            <Typography
              component='span'
              variant='caption'
              sx={{ color: 'var(--text-muted)' }}
            >
              —
            </Typography>
          )
      },
      {
        id: 'items',
        header: t('purchases:list.columns.items'),
        align: 'end',
        cell: (p) => Number(p.items_count)
      },
      ...(canViewProductCost
        ? [
            {
              id: 'items_subtotal',
              header: t('purchases:list.columns.items_subtotal'),
              align: 'end' as const,
              hideOnMobile: true,
              cell: (p: PurchaseListRow) =>
                formatPKR(Number(p.items_subtotal), locale)
            },
            {
              id: 'overhead',
              header: t('purchases:list.columns.overhead'),
              align: 'end' as const,
              hideOnMobile: true,
              cell: (p: PurchaseListRow) =>
                Number(p.overhead_subtotal) > 0
                  ? formatPKR(Number(p.overhead_subtotal), locale)
                  : '—'
            },
            {
              id: 'total',
              header: t('purchases:list.columns.total'),
              align: 'end' as const,
              cell: (p: PurchaseListRow) => (
                <Typography variant='body1' sx={{ fontWeight: 600 }}>
                  {formatPKR(Number(p.total_cost), locale)}
                </Typography>
              )
            }
          ]
        : []),
      {
        id: 'note',
        header: t('purchases:list.columns.note'),
        hideOnMobile: true,
        cell: (p) =>
          p.note ? (
            <Tooltip title={p.note}>
              <span>{truncate(p.note, 30)}</span>
            </Tooltip>
          ) : (
            <Typography
              component='span'
              variant='caption'
              sx={{ color: 'var(--text-muted)' }}
            >
              —
            </Typography>
          )
      }
    ],
    [locale, serialById, t, canViewProductCost]
  )

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', width: '100%' }}>
      <PageHeader
        title={t('purchases:title')}
        subtitle={t('purchases:subtitle')}
        actions={
          // v2.9.1: grey-out per B.2 (CRUD action). The route guard for
          // /purchases/new already enforces, but the page-level affordance
          // surfaces the disabled state.
          <PermissionGated permission='record_purchase'>
            <Button
              variant='primary'
              startIcon={<AddIcon />}
              onClick={() => navigate(paths.newPurchase)}
            >
              {t('purchases:add_purchase')}
            </Button>
          </PermissionGated>
        }
      />

      {/* Filters */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', md: 'flex-end' }}
        sx={{ mb: 2 }}
      >
        <Box sx={{ flex: '1 1 200px', minWidth: 180 }}>
          <TextField
            select
            size='small'
            fullWidth
            label={t('purchases:list.filter.date_range')}
            value={preset}
            onChange={(e) => setPreset(e.target.value as Preset)}
          >
            <MenuItem value='mtd'>{t('purchases:list.filter.mtd')}</MenuItem>
            <MenuItem value='last_30'>
              {t('purchases:list.filter.last_30')}
            </MenuItem>
            <MenuItem value='last_90'>
              {t('purchases:list.filter.last_90')}
            </MenuItem>
            <MenuItem value='this_year'>
              {t('purchases:list.filter.this_year')}
            </MenuItem>
            <MenuItem value='custom'>
              {t('purchases:list.filter.custom')}
            </MenuItem>
          </TextField>
        </Box>
        {preset === 'custom' && (
          <>
            <Box sx={{ flex: '1 1 140px' }}>
              <TextField
                size='small'
                fullWidth
                type='date'
                label={t('purchases:list.filter.from')}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Box>
            <Box sx={{ flex: '1 1 140px' }}>
              <TextField
                size='small'
                fullWidth
                type='date'
                label={t('purchases:list.filter.to')}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </Box>
          </>
        )}
        <Box sx={{ flex: '2 1 280px' }}>
          <SupplierCombobox
            value={supplierId}
            onChange={setSupplierId}
            label={t('purchases:list.filter.supplier')}
            size='small'
          />
        </Box>
        <Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={includeOpening}
                onChange={(e) => setIncludeOpening(e.target.checked)}
              />
            }
            label={t('purchases:list.filter.include_opening')}
          />
        </Box>
      </Stack>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(p) => p.id}
        loading={isLoading}
        onRowClick={(p) => navigate(paths.gotoPurchase(p.id))}
        empty={
          <Box sx={{ py: 4 }}>
            <EmptyState title={t('purchases:empty')} />
          </Box>
        }
        ariaLabel={t('purchases:title')}
      />

      {total > PAGE_SIZE && (
        <Pagination
          page={page + 1}
          total={total}
          pageSize={PAGE_SIZE}
          onChange={(p) => setPage(p - 1)}
        />
      )}
    </Box>
  )
}
