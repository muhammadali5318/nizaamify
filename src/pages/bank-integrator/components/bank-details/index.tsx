// src/components/dashboard/BankDetails.tsx
import React, { useCallback, useEffect, useState } from 'react'
import {
  Box,
  Button,
  Divider,
  Stack,
  Typography,
  CircularProgress
} from '@mui/material'
import styles from './selectBank.module.scss'
import { StatusChip } from 'src/pages/team-management/team-members/components/TeamMembers'
import AccountCard from './AccountCard'
import { Step } from '../..'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { notify } from 'src/components/notistack/NotificationProvider'
import { useDispatch } from 'react-redux'
import {
  setConnectionId,
  setStatus
} from 'src/store/slices/bankConnectionSlice'
import { toTitleCase } from 'src/utils/stringUtils'

/* ---------------------------
   Types for API responses
   --------------------------- */

interface Institution {
  id: string
  name?: string
  full_name?: string
  country_code2?: string
  environment_type?: string
  icon_url?: string
  logo_url?: string
  features?: string[]
}

interface ConnectionData {
  id: number | string
  institution?: Institution
  status?: string
  feature_scope?: string[]
  created_at_remote?: string | null
  authorised_at?: string | null
  last_confirmed_at?: string | null
  reconfirm_by?: string | null
  expires_at?: string | null
  last_successful_sync_at?: string | null
  is_active?: boolean
  // any other fields
  [k: string]: any
}

export interface BankAccount {
  id: number
  yapily_account_id: string
  name: string
  nickname: string | null
  currency: string
  account_holder_name: string
  iban: string | null
  sort_code: string | null
  account_number: string | null
  primary: boolean
}

interface AccountsResponse {
  // shape unknown — keep flexible
  accounts?: BankAccount[]
  data?: {
    accounts?: BankAccount[]
  }
  // fallback: entire response payload
  [k: string]: any
}

/* ---------------------------
   Props
   --------------------------- */

interface BankDetailsProps {
  goToStep: (step: Step) => void
}

/* ---------------------------
   Component
   --------------------------- */

const BankDetails: React.FC<BankDetailsProps> = ({ goToStep }) => {
  const { activePracticeId } = useActivePractice()
  const dispatch = useDispatch()

  const [connection, setConnection] = useState<ConnectionData | null>(null)
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const disconnectBank = useCallback(async () => {
    if (!activePracticeId) return
    try {
      const response = await apiClient.delete(
        endpoints.bankIntegrator.revokeConnection(activePracticeId)
      )
      if (response.status === 204) {
        goToStep('connect-bank')
        localStorage.removeItem('bank_connection_id')
        dispatch(setStatus(null))
        dispatch(setConnectionId(null))
        setConnection(null)
        setAccounts([])
        notify.success('Bank disconnected successfully.')
      } else {
        notify.error('Failed to disconnect the bank. Please try again.')
      }
    } catch {
      notify.error('Something went wrong, Please try again later.')
    }
  }, [activePracticeId, dispatch, goToStep])

  const parsePayload = <T,>(res: any): T | null => {
    if (!res) return null
    if (res.data && res.data.data) return res.data.data as T
    if (res.data) return res.data as T
    return res as T
  }

  const fetchAccountsDetails = useCallback(async () => {
    if (!activePracticeId) return
    setIsLoading(true)
    try {
      const connRes = await apiClient.get(
        endpoints.bankIntegrator.connectionDetails(activePracticeId)
      )
      const accRes = await apiClient.get(
        endpoints.bankIntegrator.accountsDetails(activePracticeId)
      )

      const connPayload = parsePayload<ConnectionData>(connRes)
      const accPayload = parsePayload<AccountsResponse>(accRes)

      if (connPayload && accPayload) {
        setConnection(connPayload)
        setAccounts(accPayload?.results)
      }
    } catch (err) {
      console.error('fetchAccountsDetails error', err)
      notify.error(
        'Unable to fetch bank connection or accounts. Please try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [activePracticeId, dispatch])

  useEffect(() => {
    fetchAccountsDetails()
  }, [activePracticeId])

  const formatDate = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleString('en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short'
        })
      : '-'

  return (
    <Box className={styles.selectYourBankRoot}>
      <Box className={styles.selectYourBankContainer}>
        <Box
          alignSelf='flex-start'
          sx={{ display: { xs: 'block', sm: 'none' } }}
        >
          <StatusChip
            status={
              connection?.is_active
                ? 'Active'
                : (connection?.status ?? 'Unknown')
            }
          />
        </Box>

        <Box
          display={'flex'}
          gap={2.5}
          width={'100%'}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent={'space-between'}
        >
          <Box
            display={'flex'}
            gap={2.5}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
          >
            <img
              src={connection?.institution?.logo_url ?? '/assets/back-clr.svg'}
              alt='bank logo'
              style={{ width: 40, height: 40 }}
            />

            <Stack spacing={0.5}>
              <Typography variant='h5' fontWeight={700}>
                {connection?.institution?.full_name ??
                  connection?.institution?.name ??
                  'Bank'}
              </Typography>

              <Box
                display='flex'
                gap={1}
                flexDirection={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
              >
                {/* Connected */}
                <Box display='flex' gap='10px'>
                  <img
                    className='icon-dimension--24'
                    src='/assets/calendar.svg'
                    alt='calendar icon'
                  />
                  <Typography variant='body1'>
                    Connected on{' '}
                    {formatDate(
                      connection?.authorised_at ?? connection?.created_at_remote
                    )}
                  </Typography>
                </Box>

                <Divider
                  orientation='vertical'
                  sx={{ display: { xs: 'none', sm: 'block' } }}
                />

                <Box display='flex' gap='10px'>
                  <img src='/assets/calendar.svg' alt='calendar icon' />
                  <Typography variant='body1'>
                    Expires on{' '}
                    {formatDate(
                      connection?.reconfirm_by ?? connection?.expires_at
                    )}
                  </Typography>
                </Box>
              </Box>
            </Stack>
          </Box>

          <Box
            alignSelf='flex-start'
            sx={{ display: { xs: 'none', sm: 'block' } }}
          >
            <StatusChip
              status={
                connection?.is_active
                  ? 'Active'
                  : (connection?.status ?? 'Unknown')
              }
            />
          </Box>
        </Box>

        <Stack spacing={1} width={'100%'}>
          <Typography variant='body1'>
            Connected Accounts ({accounts.length}):
          </Typography>

          <Box className={styles.accountCardsContainer}>
            {isLoading ? (
              <Box
                display='flex'
                alignItems='center'
                justifyContent='center'
                width='100%'
                py={4}
              >
                <CircularProgress />
              </Box>
            ) : accounts.length ? (
              accounts.map((acct, idx) => (
                // pass account as prop; adapt if AccountCard expects different props
                <AccountCard key={(acct.id ?? idx).toString()} account={acct} />
              ))
            ) : (
              <Typography variant='body2' color='text.secondary'>
                No accounts connected.
              </Typography>
            )}
          </Box>
        </Stack>

        <Box className={styles.accessPermissionContainer}>
          <Box display={'flex'} gap={'10px'}>
            <img src='/assets/wallet.svg' alt='wallet icon' />
            <Stack>
              <Typography variant='subtitle1' fontWeight={700}>
                Access Permissions
              </Typography>
              <Typography variant='caption' color='text.secondary'>
                Information Monai can access
              </Typography>
            </Stack>
          </Box>

          <Stack spacing={'10px'} width={'100%'}>
            {[
              'Account details and holder information',
              'Current account balances',
              'Transaction history'
            ].map((feature, idx) => (
              <Box
                key={idx}
                display={'flex'}
                gap={'10px'}
                alignItems={'center'}
                padding={'10px'}
                alignSelf={'stretch'}
                borderRadius={'12px'}
                bgcolor={'#fff'}
                width={'100%'}
              >
                <img src='/assets/green-verify.svg' alt='wallet icon' />
                <Typography variant='subtitle1'>
                  {toTitleCase(feature)}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        <Box className={styles.disconnectContainer}>
          <Stack>
            <Typography variant='subtitle1' fontWeight={700} color='error.main'>
              Disconnect Bank
            </Typography>
            <Typography variant='caption' color='text.secondary'>
              Remove this bank connection from Monai
            </Typography>
          </Stack>

          <Button
            variant='contained'
            size='large'
            color='error'
            onClick={disconnectBank}
            startIcon={
              <img src='/assets/disconnect.svg' alt='disconnect icon' />
            }
          >
            Disconnect {connection?.institution?.name ?? 'Bank'}
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

export default BankDetails
