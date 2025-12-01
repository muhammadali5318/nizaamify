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
import { useQueryClient } from '@tanstack/react-query'

const Billing = () => {
  const queryClient = useQueryClient()

  const { activePractice, activePracticeId } = useActivePractice()
  const practiceId = activePracticeId
  const isSubscribed = (activePractice as any)?.subscription_details
    ?.is_subscribed
  const subscriptionPlan = (activePractice as any)?.subscription_details
    ?.subscription_plan_name
  const subscriptionPlanAmount = (activePractice as any)?.subscription_details
    ?.subscription_plan_amount
  const rawDate = (activePractice as any)?.subscription_details
    ?.next_billing_date

  const billingDate = rawDate
    ? new Date(rawDate).toISOString().split('T')[0].replace(/-/g, '/')
    : ''
  const SUBSCRIBED_PLAN = getSubscribedPlan(activePractice)
  const FREE_PLAN = getFreePlan(activePractice)
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
          ? dayjs(dateRange[0]).format('YYYY-MM-DD')
          : undefined,
        end_date: dateRange[1]
          ? dayjs(dateRange[1]).format('YYYY-MM-DD')
          : undefined
      }

      const res = await getInvoices(params)

      setRows(res?.data?.results || [])
      setTotalCount(res?.data?.count || 0)
    } catch {
      notify.error('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
  }, [practiceId, page, pageSize, debouncedSearchKey, dateRange])
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
      setSubscriptionLoading(true) // ⬅️ Start loader

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
      await fetchInvoices()
    } catch (error: any) {
      notify.error(error?.message)
    } finally {
      setSubscriptionLoading(false) // ⬅️ Stop loader
    }
  }

  return (
    <Box
      sx={{
        marginLeft: { xs: 3, sm: 3, md: 3 },
        paddingTop: 2,
        width: { xs: '100%', sm: '94%', md: '94%', lg: '96%' }
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          gap: 2,
          mb: 2,
          alignItems: 'center'
        }}
      >
        <img src={billImg} alt='bill' />
        <Box>
          <Typography variant='h6' fontWeight={700}>
            Subscription Packages
          </Typography>
          <Typography variant='body2' sx={{ color: '#8C8C8C' }}>
            Keep track of your subscription details, payments, and invoices.
          </Typography>
        </Box>
      </Box>

      {isSubscribed && subscriptionPlan === 'PROFESSIONAL' ? (
        <SubscriptionCard
          {...SUBSCRIBED_PLAN}
          loading={subscriptionLoading}
          onButtonClick={handleButtonClick}
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
          />
          <SubscriptionCard
            isSubscribed={isSubscribed}
            {...SUBSCRIBED_PLAN}
            loading={subscriptionLoading}
            onButtonClick={handleButtonClick}
          />
        </Box>
      )}
      {subscriptionPlan === 'PROFESSIONAL' && (
        <Box
          sx={{
            border: '1px solid #EEEEEE',
            borderRadius: '24px',
            padding: 1,
            mt: 2
          }}
        >
          <PaymentSettings
            subscriptionPlanAmount={subscriptionPlanAmount}
            billingDate={billingDate}
          />
        </Box>
      )}
      {/* -------------------- INVOICE HISTORY TABLE -------------------- */}
      <Box
        sx={{
          mt: 2,
          border: '1px solid #efefef',
          pt: 1,
          borderRadius: '12px',
          mb: 5
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            gap: 2,
            mb: 2,
            alignItems: 'center',
            ml: 1
          }}
        >
          <img src={fileBlueIcon} alt='file' />
          <Box>
            <Typography variant='h6' fontWeight={700}>
              Billing History
            </Typography>
            <Typography sx={{ color: '#BEBEBE', fontSize: '16px' }}>
              Search, filter, and manage your uploaded documents
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, px: 2, pb: 2 }}>
          <Box>
            <TextField
              variant='outlined'
              label='Search'
              placeholder='Search invoice number…'
              value={searchKey}
              onChange={(e) => {
                setSearchKey(e.target.value)
              }}
              sx={{
                '& .MuiOutlinedInput-notchedOutline': {
                  borderRadius: '12px'
                }
              }}
            />
          </Box>

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box>
              <DatePicker
                format='YYYY/MM/DD'
                label='Start date'
                value={dateRange[0]}
                onChange={(newValue) => {
                  setDateRange([newValue, dateRange[1]])
                  setPage(0)
                }}
                slotProps={{
                  textField: {
                    sx: {
                      '& .MuiPickersInputBase-root': {
                        borderRadius: '12px'
                      }
                    }
                  }
                }}
              />
            </Box>

            <DatePicker
              format='YYYY/MM/DD'
              label='End date'
              value={dateRange[1]}
              onChange={(newValue) => {
                setDateRange([dateRange[0], newValue])
                setPage(0)
              }}
              slotProps={{
                textField: {
                  sx: {
                    '& .MuiPickersInputBase-root': {
                      borderRadius: '12px' // outer container
                    }
                  }
                }
              }}
            />
          </LocalizationProvider>

          <Button
            variant='text'
            onClick={handleClearFilters}
            startIcon={<CloseIcon />}
          >
            Clear
          </Button>
        </Box>
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
  )
}

export default Billing
