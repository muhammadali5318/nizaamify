import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  Stepper,
  Step,
  StepLabel,
  Box
} from '@mui/material'
import { CustomStepperConnector } from 'src/components/common/CustomStepperConnector'

// Types
export type ArchiveStepRenderControls = {
  goNext: () => void
  goBack: () => void
  goTo: (index: number) => void
  isFirst: boolean
  isLast: boolean
  close: () => void
}

export type ArchiveStepItem = {
  // text shown under the stepper circle (desktop)
  label: string
  // either provide `render` for full control, or `Component` + optional `componentProps`
  render?: (controls: ArchiveStepRenderControls) => React.ReactNode
  Component?: React.ComponentType<any>
  componentProps?: Record<string, any>
}

interface ArchivePracticeProps {
  open: boolean
  onClose: () => void
  steps: ArchiveStepItem[]
  // optional starting step
  initialStep?: number
}

export default function ArchivePractice({
  open,
  onClose,
  steps,
  initialStep = 0
}: ArchivePracticeProps) {
  const [activeStep, setActiveStep] = useState<number>(initialStep)

  const goNext = () => setActiveStep((s) => Math.min(steps.length - 1, s + 1))
  const goBack = () => setActiveStep((s) => Math.max(0, s - 1))
  const goTo = (index: number) =>
    setActiveStep(() => Math.max(0, Math.min(steps.length - 1, index)))

  const handleClose = () => {
    setActiveStep(initialStep)
    onClose()
  }

  const controls: ArchiveStepRenderControls = {
    goNext,
    goBack,
    goTo,
    isFirst: activeStep === 0,
    isLast: activeStep === steps.length - 1,
    close: handleClose
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth='sm'
      slotProps={{
        paper: {
          sx: {
            py: '36px',
            px: { xs: 2, sm: 6 },
            borderRadius: '24px'
          }
        }
      }}
    >
      <DialogContent sx={{ padding: '0px' }}>
        <Box sx={{ width: '100%' }}>
          <Stepper
            activeStep={activeStep}
            orientation={'horizontal'}
            nonLinear
            connector={
              <CustomStepperConnector
                orientation={'horizontal'}
                horizontalConnectorMarginX={'24px'}
              />
            }
          >
            {steps.map((s, idx) => (
              <Step key={`${s.label}-${idx}`}>
                {/* Desktop label */}
                <StepLabel
                  sx={{
                    display: { xs: 'none', sm: 'flex' }
                  }}
                >
                  {s.label}
                </StepLabel>

                {/* Mobile label (hidden text node so the step circle stays aligned) */}
                <StepLabel
                  sx={{
                    display: { xs: 'block', sm: 'none' }
                  }}
                ></StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        <Box sx={{ mt: 2 }}>
          {steps.map((s, idx) => {
            if (idx !== activeStep) return null

            // prefer `render` if provided (gives full control)
            if (s.render)
              return (
                <React.Fragment key={idx}>{s.render(controls)}</React.Fragment>
              )

            // otherwise, render `Component` if provided and pass helpful controls and any custom props
            if (s.Component) {
              const Component = s.Component
              return (
                <Component
                  key={idx}
                  {...controls}
                  {...(s.componentProps ?? {})}
                />
              )
            }

            // fallback: show nothing
            return null
          })}
        </Box>
      </DialogContent>
    </Dialog>
  )
}
