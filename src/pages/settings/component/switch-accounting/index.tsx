import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  Stack,
  FormControl,
  InputLabel,
  MenuItem,
  Select
} from '@mui/material'
import { paths } from 'src/paths'
import { useNavigate } from 'react-router'
import RenderUlList from 'src/components/render-ul-list'
import { ChevronRight } from '@mui/icons-material'

const items = [
  <>
    All existing financial data will be <strong>exported</strong> for your
    records.
  </>,
  <>
    This data will no longer <strong>remain active</strong> in the system.
  </>,
  <>
    Your <strong>practice</strong> will be <strong>reconfigured</strong> under
    the new accounting method.
  </>
]

type SwitchAccountingModalProps = {
  open: boolean
  onClose: () => void
  onSave?: () => void
  selectedAccountingBasis: string
}

const SwitchAccountingModal: React.FC<SwitchAccountingModalProps> = ({
  open,
  onClose,
  selectedAccountingBasis
}) => {
  const navigate = useNavigate()
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth='sm'
      slotProps={{
        paper: {
          sx: {
            py: '36px',
            px: { xs: 2, sm: 5 },
            borderRadius: '24px'
          }
        }
      }}
    >
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box
            component='img'
            src='/assets/grey-swap.svg'
            alt=''
            sx={{ width: { xs: 48, sm: 64 }, height: { xs: 48, sm: 64 } }}
          />

          <Typography
            className='font-weight--700'
            sx={{ typography: { xs: 'h6', sm: 'h5' } }}
          >
            Switch Accounting Basis
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, mt: 2 }}>
        <Stack spacing={'14px'}>
          <Box>
            <Typography variant='subtitle2'>
              Switching your accounting method will initiate a full system
              reset.
            </Typography>
            <RenderUlList items={items} />
          </Box>

          <Alert severity='info'>
            <Typography
              className='alert-info-text font-weight--500'
              component='div'
              sx={{ margin: 0 }}
            >
              This action cannot be undone.
            </Typography>
          </Alert>

          <FormControl fullWidth disabled>
            <InputLabel id='accounting-basis-label'>
              Accounting Basis
            </InputLabel>

            <Select
              labelId='accounting-basis-label'
              value={selectedAccountingBasis}
              label='Accounting Basis'
            >
              <MenuItem value='CASH'>Cash Basis</MenuItem>
              <MenuItem value='ACCRUAL'>Accrual Basis</MenuItem>
            </Select>
          </FormControl>
          <Stack
            sx={{
              padding: 1.5,
              borderRadius: '12px',
              backgroundColor: 'var(--grey-100, #F5F5F5)'
            }}
            spacing={'10px'}
          >
            <Typography variant='h6' fontWeight={500}>
              If you’re unsure, we recommend reviewing this first:
            </Typography>
            <Box
              sx={{
                display: 'flex',
                padding: '6px',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                alignSelf: 'stretch',
                borderRadius: '24px',
                backgroundColor: 'var(--primary-contrastText, #FFF)',
                width: '100%'
              }}
            >
              <Box display={'flex'} gap={1.5} alignItems={'center'}>
                <img src='/assets/play-icon.svg' alt='play-icon' />
                <Typography variant='subtitle1'>
                  Watch how accounting methods work
                </Typography>
              </Box>
              <Box p={1}>
                <img src='/assets/OpeninNewFilled.svg' alt='external icon' />
              </Box>
            </Box>
          </Stack>
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          p: 0,
          mt: 2.5,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2
        }}
      >
        <Button
          onClick={onClose}
          variant='outlined'
          size='large'
          fullWidth
          sx={{ flex: 1 }}
        >
          Cancel
        </Button>

        <Button
          sx={{ flex: 1 }}
          variant='contained'
          size='large'
          color='error'
          fullWidth
          onClick={() => navigate(paths.accountingBasisSettings)}
          endIcon={<ChevronRight />}
        >
          Proceed with Switch
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default SwitchAccountingModal
