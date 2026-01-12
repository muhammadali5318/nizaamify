import React from 'react'
import {
  Box,
  Card,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Stack
} from '@mui/material'
import { StepFiveFormValues } from 'src/schema-validations/practice-onboarding/stepFive'
import styles from './AccountingBasisInfo.module.scss'
import { AccountingBasisInfo } from 'src/const'

export type AccountingBasisType = StepFiveFormValues['accountingBasis']

type Props = {
  data: AccountingBasisInfo
}

const AccountingBasisCard: React.FC<Props> = ({ data }) => {
  const { header, description, pros, cons, alertText, testId } = data

  return (
    <Card
      data-testid={testId}
      elevation={0}
      className={styles.accountingBasisRoot}
    >
      <Stack spacing={2} alignItems='flex-start'>
        <Box>
          <Typography variant='h5' fontWeight={700} gutterBottom>
            {header}
          </Typography>

          <Typography variant='body1'>{description}</Typography>
        </Box>

        <Box>
          <Typography variant='h6' fontWeight={700}>
            Pros
          </Typography>

          <List sx={{ padding: 0 }}>
            {pros.map((b, i) => (
              <ListItem
                key={i}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  py: 0.5,
                  px: 0,
                  gap: '14px'
                }}
              >
                <ListItemIcon sx={{ minWidth: 28, pt: '2px' }}>
                  <img
                    src={'/assets/ticket-icon-black.svg'}
                    alt='tick'
                    style={{ width: 20, height: 20, display: 'block' }}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={b}
                  primaryTypographyProps={{
                    variant: 'body1',
                    component: 'div'
                  }}
                />
              </ListItem>
            ))}
          </List>

          <Typography variant='h6' fontWeight={700}>
            Cons
          </Typography>

          <List sx={{ padding: 0 }}>
            {cons.map((b, i) => (
              <ListItem
                key={i}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  py: 0.5,
                  px: 0,
                  gap: '14px'
                }}
              >
                <ListItemIcon sx={{ minWidth: 28, pt: '2px' }}>
                  <img
                    src={'/assets/ticket-icon-black.svg'}
                    alt='tick'
                    style={{ width: 20, height: 20, display: 'block' }}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={b}
                  primaryTypographyProps={{
                    variant: 'body1',
                    component: 'div'
                  }}
                />
              </ListItem>
            ))}
          </List>

          <Alert severity='info' sx={{ mt: 1 }}>
            <Typography component='div' sx={{ margin: 0 }}>
              {alertText}
            </Typography>
          </Alert>
        </Box>
      </Stack>
    </Card>
  )
}

export default AccountingBasisCard
