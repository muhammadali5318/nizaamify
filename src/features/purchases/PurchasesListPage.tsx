import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { paths } from 'src/paths'
import { usePurchases } from './hooks'
import { formatPKR } from 'src/features/subscription/env'

export default function PurchasesListPage() {
  const { t, i18n } = useTranslation(['purchases', 'common'])
  const navigate = useNavigate()
  const { data, isLoading } = usePurchases()
  const locale = i18n.language === 'ur' ? 'ur-PK' : 'en-PK'

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
        <Box>
          <Typography variant='h5' fontWeight={700}>
            {t('purchases:title')}
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            {t('purchases:subtitle')}
          </Typography>
        </Box>
        <Button
          variant='contained'
          startIcon={<AddIcon />}
          onClick={() => navigate(paths.newPurchase)}
        >
          {t('purchases:add_purchase')}
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
              {t('purchases:empty')}
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('purchases:list.date')}</TableCell>
                  <TableCell>{t('purchases:list.source')}</TableCell>
                  <TableCell align='right'>
                    {t('purchases:list.items')}
                  </TableCell>
                  <TableCell align='right'>
                    {t('purchases:list.total')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((p) => {
                  const itemCount =
                    (p.purchase_items as unknown as { qty: number }[])?.reduce(
                      (s, it) => s + (it?.qty ?? 0),
                      0
                    ) ?? 0
                  return (
                    <TableRow
                      key={p.id}
                      hover
                      onClick={() => navigate(paths.gotoPurchase(p.id))}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        {new Intl.DateTimeFormat(locale, {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        }).format(new Date(p.purchase_date))}
                      </TableCell>
                      <TableCell>{p.source ?? '—'}</TableCell>
                      <TableCell align='right'>{itemCount}</TableCell>
                      <TableCell align='right'>
                        {formatPKR(p.total_cost, locale)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  )
}
