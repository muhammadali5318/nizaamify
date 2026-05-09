import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import {
  useDeleteCustomer,
  useListCustomers,
  type CustomerListRow
} from './hooks'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
import { formatPKR } from 'src/features/subscription/env'
import {
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Input,
  Pagination,
  Tooltip,
  type DataTableColumn
} from 'src/components/ui'
import { PageHeader } from 'src/components/layout'

const PAGE_SIZE = 25

const truncate = (s: string, n = 40) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s

export default function CustomersListPage() {
  const { t, i18n } = useTranslation(['customers', 'common'])
  const navigate = useNavigate()
  const notify = useNotifier()
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'
  const remove = useDeleteCustomer()

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(0)
  const [confirm, setConfirm] = useState<CustomerListRow | null>(null)

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

  const onDelete = async () => {
    if (!confirm) return
    try {
      await remove.mutateAsync(confirm.id)
      notify.success(t('customers:messages.deleted'))
      setConfirm(null)
    } catch {
      notify.error(t('customers:errors.delete_failed'))
    }
  }

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
      cell: (c) => (
        <Typography
          variant='body1'
          sx={{
            fontWeight: 600,
            color:
              c.outstanding > 0 ? 'var(--warning-700)' : 'var(--text-muted)'
          }}
        >
          {formatPKR(c.outstanding, locale)}
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
      cell: (c) => {
        const hasHistory = c.invoice_count > 0 || c.outstanding > 0
        return (
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
            <Tooltip
              title={
                hasHistory
                  ? t('customers:actions.delete_blocked')
                  : t('customers:actions.delete')
              }
            >
              <span>
                <IconButton
                  size='small'
                  disabled={hasHistory}
                  onClick={() => setConfirm(c)}
                  aria-label={t('customers:actions.delete')}
                >
                  <DeleteOutlineIcon fontSize='small' />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        )
      }
    }
  ]

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', width: '100%' }}>
      <PageHeader
        title={t('customers:title')}
        actions={
          <Button
            variant='primary'
            startIcon={<AddIcon />}
            onClick={() => navigate(paths.newCustomer)}
          >
            {t('customers:add_customer')}
          </Button>
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

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={onDelete}
        title={t('customers:actions.confirm_delete_title')}
        description={t('customers:actions.confirm_delete_body', {
          name: confirm?.name ?? ''
        })}
        confirmLabel={t('customers:actions.confirm_delete_ok')}
        cancelLabel={t('customers:actions.confirm_delete_cancel')}
        loading={remove.isPending}
        destructive
      />
    </Box>
  )
}
