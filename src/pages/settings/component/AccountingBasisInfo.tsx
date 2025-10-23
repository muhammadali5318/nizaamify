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

export type AccountingBasisType = StepFiveFormValues['accountingBasis']

export interface AccountingBasisInfo {
  value: AccountingBasisType
  iconPath: string
  header: string
  description: string
  bullets: string[]
  alertText: string
  testId: string
}

type Props = {
  data: AccountingBasisInfo
}

const AccountingBasisCard: React.FC<Props> = ({ data }) => {
  const { header, description, bullets, alertText, testId } = data

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
            You’ll get:
          </Typography>

          <List sx={{ padding: 0 }}>
            {bullets.map((b, i) => (
              <ListItem
                key={i}
                sx={{ display: 'flex', alignItems: 'center', py: 0.5 }}
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
