import { Box, Typography } from '@mui/material'

interface ExpensesGrandTotalProps {
  total: number | string
}

const ExpensesGrandTotal = ({ total }: ExpensesGrandTotalProps) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', sm: 'center' },
        padding: { xs: '8px 12px', sm: '12px 14px' },
        borderRadius: '20px',
        background: '#F3F4F6',
        gap: { xs: 1, sm: 0 },
        width: '100%'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          alignItems: 'center',
          flexWrap: 'wrap'
        }}
      >
        <Typography
          variant='caption'
          sx={{
            display: 'inline-flex',
            padding: '4px 6px',
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: '12px',
            border: '1px solid #101828',
            background: '#1E2939',
            color: '#fff',
            lineHeight: 1
          }}
        >
          GRAND TOTAL
        </Typography>

        <Typography
          variant='body2'
          color='#4A5565'
          sx={{ whiteSpace: { xs: 'normal', sm: 'nowrap' } }}
        >
          All Categories
        </Typography>
      </Box>

      <Box display={'flex'} alignItems={'center'} gap={'10px'}>
        <Typography variant='subtitle2' color='#4A5565'>
          Total Monthly Expenses:
        </Typography>
        <Typography variant='h5' fontWeight={700}>
          £{total ?? '-'}
        </Typography>
      </Box>
    </Box>
  )
}

export default ExpensesGrandTotal
