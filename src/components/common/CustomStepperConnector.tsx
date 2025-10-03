// Connector.tsx
import StepConnector, {
  stepConnectorClasses
} from '@mui/material/StepConnector'
import { styled } from '@mui/material/styles'

type CustomStepperConnectorProps = {
  connectorHeight?: number
  orientation?: 'horizontal' | 'vertical'
}

export const CustomStepperConnector = styled(StepConnector, {
  shouldForwardProp: (prop) =>
    prop !== 'connectorHeight' && prop !== 'orientation'
})<CustomStepperConnectorProps>(
  ({ connectorHeight = 40, orientation = 'vertical' }) => ({
    [`&.${stepConnectorClasses.root}`]: {
      marginLeft: orientation === 'vertical' ? 10 : 0,
      marginTop: orientation === 'horizontal' ? 10 : 0
    },
    [`& .${stepConnectorClasses.line}`]: {
      ...(orientation === 'vertical' && {
        minHeight: connectorHeight,
        width: 4
      }),
      ...(orientation === 'horizontal' && {
        minWidth: connectorHeight,
        height: 4
      }),
      border: 'none',
      backgroundColor: 'var(--components-stepper-connector)',
      borderRadius: 12
    },
    [`&.${stepConnectorClasses.active} .${stepConnectorClasses.line}`]: {
      backgroundColor: 'var(--color-primary-black)'
    },

    [`&.${stepConnectorClasses.completed} .${stepConnectorClasses.line}`]: {
      backgroundColor: 'var(--color-primary-black)'
    }
  })
)

export const StepperLabelSX = {
  color: 'var(--color-text-disabled)',
  [`&.Mui-active`]: {
    color: 'black'
  },
  [`&.Mui-completed`]: {
    color: 'black'
  }
}
