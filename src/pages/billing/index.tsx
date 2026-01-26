import { useState, useEffect } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import SubscriptionCard from './components/SubscriptionCard'
import billImg from '../../assets/bill-icon.svg'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { getSubscribedPlan, getFreePlan } from './constants/subscriptionPlans'
import { handleSubscriptionAction } from './utils/HandleSubscriptionAction'
import { notify } from 'src/components/notistack/NotificationProvider'
import { getInvoices } from '../../services/apis/getInvoices'
import DocumentsTable from '../documents/components/documents-list/DocumentsTable'
import { invoiceColumns } from './constants/invoiceTableColumns'
import fileBlueIcon from '../../assets/document-upload-card-icon.svg'
import dayjs from 'dayjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { useDebounce } from 'src/hooks/useDebounce'
import CloseIcon from '@mui/icons-material/Close'
import PaymentSettings from './components/PaymentSettings'
import { hasPermission } from 'src/config/module-permissions'
import { useQueryClient } from '@tanstack/react-query'

const Billing = () => {
  const { activePractice, activePracticeId } = useActivePractice()
  const practiceId = activePracticeId

  const isSubscribed = (activePractice as any)?.subscription_details
    ?.is_subscribed
  const subscriptionPlan = (activePractice as any)?.subscription_details
    ?.subscription_plan_name
  const subscriptionPlanAmount = (activePractice as any)?.subscription_details
    ?.subscription_plan_amount
  const has_used_free_trial = (activePractice as any)?.subscription_details
    ?.has_used_free_trial
  const has_free_trial_eligibility = (activePractice as any)
    ?.subscription_details?.has_free_trial_eligibility
  const current_period_end = (activePractice as any)?.subscription_details
    ?.current_period_end
  const rawDate = (activePractice as any)?.subscription_details
    ?.next_billing_date
  const cancelled_at = (activePractice as any)?.subscription_details
    ?.cancelled_at

  const formatDate = (date: string) => {
    const d = new Date(date)
    return `${String(d.getDate()).padStart(2, '0')}/${String(
      d.getMonth() + 1
    ).padStart(2, '0')}/${d.getFullYear()}`
  }
  const formattedDate = current_period_end
    ? dayjs(current_period_end).format('DD MMMM YYYY')
    : ''
  const canViewInvoices = hasPermission('subs.view_invoices')

  const billingDate = rawDate ? formatDate(rawDate) : ''
  const cancelledAtDate = current_period_end ? formattedDate : ''
  const SUBSCRIBED_PLAN = getSubscribedPlan(activePractice)
  const FREE_PLAN = getFreePlan(activePractice)
  const queryClient = useQueryClient()

  const [rows, setRows] = useState<any[]>([])
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [sortModel, setSortModel] = useState<any>([])
  const [loading, setLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  const [searchKey, setSearchKey] = useState('')
  const debouncedSearchKey = useDebounce(searchKey, 500)
  const [dateRange, setDateRange] = useState<[any, any]>([null, null])
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)

  const fetchInvoices = async () => {
    if (!practiceId) return
    try {
      setLoading(true)

      const params = {
        practiceId,
        page: page + 1,
        pageSize,
        search: debouncedSearchKey || undefined,
        start_date: dateRange[0]
          ? dayjs(dateRange[0]).format('DD-MM-YYYY')
          : undefined,
        end_date: dateRange[1]
          ? dayjs(dateRange[1]).format('DD-MM-YYYY')
          : undefined
      }

      const res = await getInvoices(params)

      setRows(res?.data?.results || [])
      setTotalCount(res?.data?.count || 0)
    } catch {
      console.error('Failed to load invoices')
      notify.error('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canViewInvoices) {
      fetchInvoices()
    }
  }, [
    practiceId,
    page,
    pageSize,
    debouncedSearchKey,
    dateRange,
    canViewInvoices
  ])
  const handleClearFilters = () => {
    setSearchKey('')
    setDateRange([null, null])
    setPage(0)
  }
  const handleButtonClick = async (buttonLabel: string, title: string) => {
    if (!practiceId) {
      notify.error('No active practice selected.')
      return
    }

    try {
      setSubscriptionLoading(true)
      await fetchInvoices()
      const res = await handleSubscriptionAction({
        buttonLabel,
        practiceId,
        title
      })
      if (res?.data?.checkout_url) {
        window.location.href = res.data.checkout_url
        return
      }

      notify.success('Subscription updated successfully!')
      await queryClient.invalidateQueries({
        queryKey: ['listAllPracticesData']
      })
    } catch (error: any) {
      notify.error(error?.message)
    } finally {
      setSubscriptionLoading(false)
    }
  }

  return (
    <Box
      sx={{
        px: { xs: 1.5, sm: 3, md: 4 },
        pt: 2,
        width: '100%'
      }}
    >
      {/* Heading Section */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          gap: 2,
          mb: 3,
          alignItems: 'center'
        }}
      >
        <img src={billImg} alt='bill' style={{ width: 40, height: 40 }} />
        <Box>
          <Typography variant='h6' fontWeight={700}>
            Subscription Packages
          </Typography>
          <Typography variant='body2' sx={{ color: '#8C8C8C' }}>
            Keep track of your subscription details, payments, and invoices.
          </Typography>
        </Box>
      </Box>

      {/* Subscription Cards */}
      {isSubscribed && subscriptionPlan === 'PROFESSIONAL' ? (
        <SubscriptionCard
          {...SUBSCRIBED_PLAN}
          loading={subscriptionLoading}
          onButtonClick={handleButtonClick}
          has_free_trial_eligibility={has_free_trial_eligibility}
          has_used_free_trial={has_used_free_trial}
          cancelled_at={cancelled_at}
          isSubscribed={isSubscribed}
          periodEndDate={cancelledAtDate}
          showHeader
        />
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 3
          }}
        >
          <SubscriptionCard
            isSubscribed={isSubscribed}
            {...FREE_PLAN}
            loading={subscriptionLoading}
            onButtonClick={handleButtonClick}
            cancelled_at={cancelled_at}
            periodEndDate={cancelledAtDate}
          />
          <SubscriptionCard
            isSubscribed={isSubscribed}
            {...SUBSCRIBED_PLAN}
            loading={subscriptionLoading}
            onButtonClick={handleButtonClick}
          />
        </Box>
      )}

      {/* Payment Settings */}

      <Box
        sx={{
          border: '1px solid #EEEEEE',
          borderRadius: '24px',
          padding: 2,
          mt: 3
        }}
      >
        {
          <PaymentSettings
            subscriptionPlanAmount={subscriptionPlanAmount}
            billingDate={billingDate}
          />
        }
      </Box>

      {/* Invoice History */}
      <Box
        sx={{
          mt: 4,
          border: '1px solid #efefef',
          borderRadius: '12px',
          pb: 3
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            gap: 2,
            alignItems: 'center',
            p: 2
          }}
        >
          <img src={fileBlueIcon} alt='file' width={38} />
          <Box>
            <Typography variant='h6' fontWeight={700}>
              Billing History
            </Typography>
            <Typography sx={{ color: '#BEBEBE', fontSize: '14px' }}>
              Search, filter, and manage your uploaded documents
            </Typography>
          </Box>
        </Box>

        {/* Filters */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            px: 2,
            pb: 2
          }}
        >
          <TextField
            fullWidth
            variant='outlined'
            label='Search'
            placeholder='Search invoice number…'
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-notchedOutline': { borderRadius: '12px' }
            }}
          />

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              format='DD/MM/YYYY'
              label='Start date'
              value={dateRange[0]}
              onChange={(newValue) => {
                setDateRange([newValue, dateRange[1]])
                setPage(0)
              }}
              slotProps={{
                textField: {
                  fullWidth: true,
                  sx: {
                    '& .MuiPickersInputBase-root': { borderRadius: '12px' }
                  }
                }
              }}
            />

            <DatePicker
              format='DD/MM/YYYY'
              label='End date'
              value={dateRange[1]}
              onChange={(newValue) => {
                setDateRange([dateRange[0], newValue])
                setPage(0)
              }}
              slotProps={{
                textField: {
                  fullWidth: true,
                  sx: {
                    '& .MuiPickersInputBase-root': { borderRadius: '12px' }
                  }
                }
              }}
            />
          </LocalizationProvider>

          <Button
            variant='text'
            onClick={handleClearFilters}
            startIcon={<CloseIcon />}
            sx={{ alignSelf: 'center' }}
          >
            Clear
          </Button>
        </Box>

        {/* Responsive Table Wrapper */}
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
          <DocumentsTable
            rows={rows}
            columns={invoiceColumns}
            page={page}
            pageSize={pageSize}
            setPage={setPage}
            setPageSize={setPageSize}
            sortModel={sortModel}
            onSortModelChange={setSortModel}
            loading={loading}
            totalCount={totalCount}
          />
        </Box>
      </Box>
    </Box>
  )
}

export default Billing
