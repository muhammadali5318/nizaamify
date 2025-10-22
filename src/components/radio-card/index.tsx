import {
  Card,
  CardActionArea,
  Radio,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Box,
  Stack
} from '@mui/material'
import { StepFiveFormValues } from 'src/schema-validations/practice-onboarding/stepFive'

const RadioCard: React.FC<{
  value: StepFiveFormValues['accountingBasis']
  selectedValue: StepFiveFormValues['accountingBasis']
  onSelect: (v: StepFiveFormValues['accountingBasis']) => void
  header: string
  description: string
  bullets: string[]
  alertText: string
  'data-testid'?: string
}> = ({
  value,
  selectedValue,
  onSelect,
  header,
  description,
  bullets,
  alertText,
  'data-testid': testId
}) => {
  const selected = selectedValue === value

  return (
    <Card
      elevation={0}
      sx={{
        position: 'relative',
        width: '100%',
        borderRadius: '24px',
        border: selected
          ? '1px solid var(--info-main, #0288D1)'
          : '1px solid transparent',
        background: selected
          ? 'var(--info-_states-selected, rgba(2, 136, 209, 0.08))'
          : 'var(--grey-50, #FAFAFA)',
        transition: 'box-shadow 150ms ease, transform 150ms ease'
        // '&:hover': {
        //   boxShadow: '0 6px 16px rgba(0,0,0,0.06)'
        // }
      }}
      data-testid={testId}
    >
      <CardActionArea
        onClick={() => onSelect(value)}
        sx={{
          textAlign: 'left',
          alignItems: 'stretch',
          display: 'block',
          px: 2.5,
          py: 2
        }}
      >
        {/* top-right radio */}
        <Stack spacing={2.5}>
          <Box display={'flex'} justifyContent={'space-between'}>
            <img src='/assets/coin-pound.svg' alt='coin' />

            <Radio
              checked={selected}
              onChange={() => onSelect(value)}
              slotProps={{
                input: {
                  'aria-label': header
                }
              }}
            />
          </Box>

          <Box>
            <Typography variant='h5' fontWeight={700}>
              {header}
            </Typography>

            <Typography variant='body1'>{description}</Typography>
          </Box>

          <Box>
            <Typography variant='h6' fontWeight={700}>
              You’ll get:
            </Typography>

            <List
              sx={{
                padding: '0px'
              }}
            >
              {bullets.map((b, i) => (
                <ListItem
                  key={i}
                  sx={{ display: 'flex', alignItems: 'center', py: 0.5 }}
                >
                  <ListItemIcon sx={{ minWidth: 28, pt: '2px' }}>
                    <img
                      src='/assets/ticket-icon-black.svg'
                      alt='tick'
                      style={{ width: 20, height: 20, display: 'block' }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={b}
                    slotProps={{
                      primary: {
                        variant: 'body1',
                        component: 'div'
                      }
                    }}
                  />
                </ListItem>
              ))}
            </List>

            <Alert severity='info' className='alert-info-container'>
              <Typography
                className='alert-info-text font-weight--500'
                component='div'
                sx={{ margin: 0 }}
              >
                {alertText}
              </Typography>
            </Alert>
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  )
}

export default RadioCard
