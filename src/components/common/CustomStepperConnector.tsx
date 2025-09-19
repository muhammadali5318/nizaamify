// Connector.tsx
import StepConnector, {
  stepConnectorClasses
} from '@mui/material/StepConnector'
import { styled } from '@mui/material/styles'

type CustomStepperConnectorProps = {
  connectorHeight?: number
}

export const CustomStepperConnector = styled(StepConnector, {
  shouldForwardProp: (prop) => prop !== 'connectorHeight'
})<CustomStepperConnectorProps>(({ connectorHeight = 40 }) => ({
  [`&.${stepConnectorClasses.root}`]: {
    marginLeft: 10
  },
  [`& .${stepConnectorClasses.line}`]: {
    minHeight: connectorHeight,
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
