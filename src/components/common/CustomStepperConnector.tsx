// Connector.tsx (updated)
import StepConnector, {
  stepConnectorClasses
} from '@mui/material/StepConnector'
import { styled } from '@mui/material/styles'

type CustomStepperConnectorProps = {
  connectorHeight?: number // use for vertical minHeight or line thickness if you want
  orientation?: 'horizontal' | 'vertical'
  horizontalConnectorMarginX?: string
}

export const CustomStepperConnector = styled(StepConnector, {
  shouldForwardProp: (prop) =>
    prop !== 'connectorHeight' && prop !== 'orientation'
})<CustomStepperConnectorProps>(
  ({
    connectorHeight = 40,
    orientation = 'vertical',
    horizontalConnectorMarginX
  }) => ({
    // root container
    [`&.${stepConnectorClasses.root}`]: {
      display: 'flex',
      ...(orientation === 'horizontal'
        ? {
            // allow the connector root to grow/shrink between steps
            flex: '1 1 0',
            minWidth: 0, // IMPORTANT: lets flex children shrink properly
            alignItems: 'center',
            marginTop: 0
          }
        : {
            marginLeft: 10,
            marginTop: 0
          })
    },

    // the visible line between steps
    [`& .${stepConnectorClasses.line}`]: {
      border: 'none',
      borderRadius: 12,
      backgroundColor: 'var(--components-stepper-connector)',

      // vertical line style
      ...(orientation === 'vertical' && {
        minHeight: connectorHeight,
        width: 4
      }),

      // horizontal line style: stretch to fill the connector root
      ...(orientation === 'horizontal' && {
        height: 4,
        width: '100%', // <-- fill available horizontal space
        alignSelf: 'center',
        margin: `0px ${horizontalConnectorMarginX ?? '8px'}`
        // if you want a max so it never touches the icons you could use padding/margins on StepIcon instead
      })
    },

    // active / completed colors
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
