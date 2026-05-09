import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import ArchiveIcon from '@mui/icons-material/Archive'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import {
  useArchiveSupplier,
  useSearchSuppliers,
  type SupplierSearchRow
} from './hooks'
import { useNotifier } from 'src/components/notistack/NotificationProvider'
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

const PAGE_SIZE = 10

const truncate = (s: string, n = 40) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s

export default function SuppliersListPage() {
  const { t } = useTranslation(['suppliers', 'common'])
  const navigate = useNavigate()
  const notify = useNotifier()
  const archive = useArchiveSupplier()

  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [page, setPage] = useState(0)
  const [confirm, setConfirm] = useState<SupplierSearchRow | null>(null)

  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(h)
  }, [search])

  useEffect(() => {
    setPage(0)
  }, [debounced])

  const { data, isLoading } = useSearchSuppliers({
    query: debounced,
    page,
    pageSize: PAGE_SIZE
  })
  const rows = data?.rows ?? []
  const total = data?.total ?? 0

  const onArchive = async () => {
    if (!confirm) return
    try {
      await archive.mutateAsync(confirm.id)
      notify.success(t('suppliers:messages.archived'))
      setConfirm(null)
    } catch {
      notify.error(t('suppliers:errors.archive_failed'))
    }
  }

  const columns: DataTableColumn<SupplierSearchRow>[] = [
    {
      id: 'name',
      header: t('suppliers:fields.name'),
      cardRole: 'heading',
      cell: (s) => s.name
    },
    {
      id: 'contact',
      header: t('suppliers:fields.contact'),
      cell: (s) =>
        s.contact ?? (
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
      id: 'address',
      header: t('suppliers:fields.address'),
      hideOnMobile: true,
      cell: (s) =>
        s.address ? (
          <Tooltip title={s.address}>
            <span>{truncate(s.address, 30)}</span>
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
      id: 'actions',
      header: '',
      align: 'end',
      width: 120,
      cardRole: 'actions',
      cell: (s) => (
        <Stack direction='row' spacing={0.5} justifyContent='flex-end'>
          <Tooltip title={t('suppliers:actions.edit')}>
            <IconButton
              size='small'
              onClick={() => navigate(paths.gotoSupplierEdit(s.id))}
              aria-label={t('suppliers:actions.edit')}
            >
              <EditIcon fontSize='small' />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('suppliers:actions.archive')}>
            <IconButton
              size='small'
              onClick={() => setConfirm(s)}
              aria-label={t('suppliers:actions.archive')}
            >
              <ArchiveIcon fontSize='small' />
            </IconButton>
          </Tooltip>
        </Stack>
      )
    }
  ]

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', width: '100%' }}>
      <PageHeader
        title={t('suppliers:title')}
        subtitle={t('suppliers:subtitle')}
        actions={
          <Button
            variant='primary'
            startIcon={<AddIcon />}
            onClick={() => navigate(paths.newSupplier)}
          >
            {t('suppliers:actions.new_supplier')}
          </Button>
        }
      />

      <Input
        placeholder={t('suppliers:search_placeholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2 }}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(s) => s.id}
        loading={isLoading}
        empty={
          <Box sx={{ py: 4 }}>
            <EmptyState title={t('suppliers:empty')} />
          </Box>
        }
        ariaLabel={t('suppliers:title')}
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
        onConfirm={onArchive}
        title={t('suppliers:actions.confirm_archive_title')}
        description={t('suppliers:actions.confirm_archive_body', {
          name: confirm?.name ?? ''
        })}
        confirmLabel={t('suppliers:actions.archive')}
        cancelLabel={t('common:actions.cancel')}
        loading={archive.isPending}
        destructive
      />
    </Box>
  )
}
