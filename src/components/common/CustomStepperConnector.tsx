// Connector.tsx
import StepConnector, {
  stepConnectorClasses
} from '@mui/material/StepConnector'
import { styled } from '@mui/material/styles'

export const CustomStepperConnector = styled(StepConnector)(() => ({
  [`&.${stepConnectorClasses.root}`]: {
    marginLeft: 10
  },
  [`& .${stepConnectorClasses.line}`]: {
    minHeight: 40,
    marginLeft: 'none',
    border: 'none',
    width: 4,
    backgroundColor: 'var(--components-stepper-connector)',
    borderRadius: 12
  },

  [`&.${stepConnectorClasses.active} .${stepConnectorClasses.line}`]: {
    backgroundColor: 'var(--color-primary-black)'
  },

  [`&.${stepConnectorClasses.completed} .${stepConnectorClasses.line}`]: {
    backgroundColor: 'var(--color-primary-black)'
  }
}))

export const StepperLabelSX = {
  color: 'var(--color-text-disabled)',
  [`&.Mui-active`]: {
    color: 'black'
  },
  [`&.Mui-completed`]: {
    color: 'black'
  }
}
