import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import { useListCustomers, type CustomerListRow } from './hooks'
import { formatPKR } from 'src/features/subscription/env'
import {
  Button,
  DataTable,
  EmptyState,
  Input,
  Pagination,
  Tooltip,
  type DataTableColumn
} from 'src/components/ui'
import { PageHeader } from 'src/components/layout'
import { PermissionGated } from 'src/components/ui/PermissionGated'
import { usePermission } from 'src/lib/permissions'

const PAGE_SIZE = 25

const truncate = (s: string, n = 40) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s

export default function CustomersListPage() {
  const { t, i18n } = useTranslation(['customers', 'common'])
  const navigate = useNavigate()
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(0)

  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(h)
  }, [search])

  useEffect(() => {
    setPage(0)
  }, [debounced])

  const { data, isLoading } = useListCustomers({
    query: debounced,
    page,
    pageSize: PAGE_SIZE
  })
  const rows = data?.rows ?? []
  const total = data?.total ?? 0

  // v2.9.1 hot-patch — outstanding numeric gated on view_customer_outstanding.
  // Without the permission, render "Has khata"/"No khata" indicator instead
  // of the formatted PKR amount, per catalog: "user sees only a has_khata
  // boolean without the numeric value."
  const canViewCustomerOutstanding = usePermission('view_customer_outstanding')

  const columns: DataTableColumn<CustomerListRow>[] = [
    {
      id: 'name',
      header: t('customers:fields.name'),
      cardRole: 'heading',
      cell: (c) => c.name
    },
    {
      id: 'phone',
      header: t('customers:fields.phone'),
      cell: (c) => c.phone
    },
    {
      id: 'address',
      header: t('customers:fields.address'),
      hideOnMobile: true,
      cell: (c) =>
        c.address ? (
          <Tooltip title={c.address}>
            <span>{truncate(c.address, 30)}</span>
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
    },
    {
      id: 'outstanding',
      header: t('customers:outstanding'),
      align: 'end',
      cell: (c) =>
        canViewCustomerOutstanding ? (
          <Typography
            variant='body1'
            sx={{
              fontWeight: 600,
              color:
                c.outstanding > 0
                  ? 'var(--status-warning-text)'
                  : 'var(--text-muted)'
            }}
          >
            {formatPKR(c.outstanding, locale)}
          </Typography>
        ) : (
          <Typography
            variant='body2'
            sx={{
              fontWeight: 500,
              color:
                c.outstanding > 0
                  ? 'var(--status-warning-text)'
                  : 'var(--text-muted)'
            }}
          >
            {c.outstanding > 0
              ? t('customers:has_khata')
              : t('customers:no_khata')}
          </Typography>
        )
    },
    {
      id: 'last_activity',
      header: t('customers:fields.last_activity'),
      hideOnMobile: true,
      cell: (c) => (
        <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
          {new Intl.DateTimeFormat(locale, { dateStyle: 'short' }).format(
            new Date(c.last_activity_at)
          )}
        </Typography>
      )
    },
    {
      id: 'actions',
      header: '',
      align: 'end',
      width: 200,
      cardRole: 'actions',
      cell: (c) => (
        <Stack direction='row' spacing={0.5} justifyContent='flex-end'>
          <Button
            variant='link'
            size='sm'
            onClick={() => navigate(paths.gotoCustomer(c.id))}
          >
            {t('customers:actions.view_history')}
          </Button>
          <Tooltip title={t('customers:actions.edit')}>
            <IconButton
              size='small'
              onClick={() => navigate(paths.gotoCustomerEdit(c.id))}
              aria-label={t('customers:actions.edit')}
            >
              <EditIcon fontSize='small' />
            </IconButton>
          </Tooltip>
        </Stack>
      )
    }
  ]

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', width: '100%' }}>
      <PageHeader
        title={t('customers:title')}
        actions={
          <PermissionGated permission='create_customer_basic'>
            <Button
              variant='primary'
              startIcon={<AddIcon />}
              onClick={() => navigate(paths.newCustomer)}
            >
              {t('customers:add_customer')}
            </Button>
          </PermissionGated>
        }
      />

      <Input
        placeholder={t('customers:search_placeholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2 }}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(c) => c.id}
        loading={isLoading}
        empty={
          <Box sx={{ py: 4 }}>
            <EmptyState title={t('customers:empty')} />
          </Box>
        }
        ariaLabel={t('customers:title')}
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
