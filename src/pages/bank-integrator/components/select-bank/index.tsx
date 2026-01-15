import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import { ChevronLeft } from '@mui/icons-material'
import styles from './selectBank.module.scss'
import BankCard from './BankCard'
import { Step } from '../../BankIntegrator'
import { useFetchAllInstitutionsData } from '../../hooks/useFetchInstitutions'
import { useAuth } from 'src/context/AuthProvider'
import { Key, useMemo, useState } from 'react'
import { setSelectedInstitution } from 'src/store/slices/selectedInstitution'
import { useDispatch } from 'react-redux'

interface Bank {
  id: Key
  full_name: string
}

interface SelectYourBankProps {
  goToStep: (step: Step) => void
}

const SelectYourBank = ({ goToStep }: SelectYourBankProps) => {
  const { accessToken } = useAuth()
  const dispatch = useDispatch()
  const { data = [] } = useFetchAllInstitutionsData(!!accessToken)

  const [search, setSearch] = useState('')

  const handleBack = () => {
    goToStep('connect-bank')
  }

  const handleSelectBank = (bank: Bank) => {
    dispatch(setSelectedInstitution(bank))
    goToStep('require-consent')
  }

  /** 🔍 Frontend search (case-insensitive) */
  const filteredBanks = useMemo(() => {
    if (!search) return data

    return data.filter((bank: Bank) =>
      bank.full_name.toLowerCase().includes(search.toLowerCase())
    )
  }, [data, search])

  return (
    <Box className={styles.selectYourBankRoot}>
      <Box className={styles.selectYourBankContainer}>
        <Button
          startIcon={<ChevronLeft />}
          variant='text'
          size='small'
          onClick={handleBack}
        >
          Back
        </Button>

        <Stack spacing={1}>
          <Typography variant='h5' component='h1' fontWeight={700}>
            Select Your Bank
          </Typography>
          <Typography variant='body1' color='text.secondary'>
            Choose the bank you want to connect
          </Typography>
        </Stack>

        <TextField
          fullWidth
          label='Search'
          placeholder='Search for your bank...'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <Box className={styles.bankCardContainer}>
          {filteredBanks.length > 0 ? (
            filteredBanks.map((bank: Bank) => (
              <BankCard
                key={bank.id}
                title={bank.full_name}
                handleClick={() => handleSelectBank(bank)}
              />
            ))
          ) : (
            <Typography color='text.secondary'>No banks found</Typography>
          )}
        </Box>
      </Box>
    </Box>
  )
}

export default SelectYourBank
