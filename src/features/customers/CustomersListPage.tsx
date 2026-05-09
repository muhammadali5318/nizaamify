import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Pagination,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
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
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

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

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack
        direction='row'
        alignItems='center'
        justifyContent='space-between'
        mb={2}
        flexWrap='wrap'
        gap={1}
      >
        <Typography variant='h5' fontWeight={700}>
          {t('customers:title')}
        </Typography>
        <Button
          variant='contained'
          startIcon={<AddIcon />}
          onClick={() => navigate(paths.newCustomer)}
        >
          {t('customers:add_customer')}
        </Button>
      </Stack>

      <TextField
        fullWidth
        size='small'
        placeholder={t('customers:search_placeholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2 }}
      />

      <Paper variant='outlined' sx={{ borderRadius: 2 }}>
        {isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant='body2' color='text.secondary'>
              {t('customers:empty')}
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('customers:fields.name')}</TableCell>
                    <TableCell>{t('customers:fields.phone')}</TableCell>
                    <TableCell>{t('customers:fields.address')}</TableCell>
                    <TableCell align='right'>
                      {t('customers:outstanding')}
                    </TableCell>
                    <TableCell>{t('customers:fields.last_activity')}</TableCell>
                    <TableCell align='right' />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((c) => {
                    const hasHistory = c.invoice_count > 0 || c.outstanding > 0
                    return (
                      <TableRow key={c.id} hover>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>{c.phone}</TableCell>
                        <TableCell>
                          {c.address ? (
                            <Tooltip title={c.address}>
                              <span>{truncate(c.address, 30)}</span>
                            </Tooltip>
                          ) : (
                            <Typography
                              component='span'
                              variant='caption'
                              color='text.secondary'
                            >
                              —
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align='right'>
                          <Typography
                            variant='body2'
                            fontWeight={600}
                            color={
                              c.outstanding > 0
                                ? 'warning.main'
                                : 'text.secondary'
                            }
                          >
                            {formatPKR(c.outstanding, locale)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant='caption' color='text.secondary'>
                            {new Intl.DateTimeFormat(locale, {
                              dateStyle: 'short'
                            }).format(new Date(c.last_activity_at))}
                          </Typography>
                        </TableCell>
                        <TableCell align='right'>
                          <Stack
                            direction='row'
                            spacing={0.5}
                            justifyContent='flex-end'
                          >
                            <Button
                              size='small'
                              onClick={() => navigate(paths.gotoCustomer(c.id))}
                            >
                              {t('customers:actions.view_history')}
                            </Button>
                            <Tooltip title={t('customers:actions.edit')}>
                              <IconButton
                                size='small'
                                onClick={() =>
                                  navigate(paths.gotoCustomerEdit(c.id))
                                }
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
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            {totalPages > 1 && (
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
                <Pagination
                  count={totalPages}
                  page={page + 1}
                  onChange={(_, p) => setPage(p - 1)}
                />
              </Box>
            )}
          </>
        )}
      </Paper>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)}>
        <DialogTitle>{t('customers:actions.confirm_delete_title')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('customers:actions.confirm_delete_body', {
              name: confirm?.name ?? ''
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)} disabled={remove.isPending}>
            {t('customers:actions.confirm_delete_cancel')}
          </Button>
          <Button
            color='error'
            variant='contained'
            onClick={onDelete}
            disabled={remove.isPending}
          >
            {t('customers:actions.confirm_delete_ok')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
