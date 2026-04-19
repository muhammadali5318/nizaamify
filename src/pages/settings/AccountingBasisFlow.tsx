import { useState } from 'react'
import {
  StepOne,
  StepTwo,
  StepThree,
  StepFour,
  StepFive
} from './component/switch-steps'
import styles from './settings.module.scss'
import AdaptiveStepper from 'src/components/common/AdaptiveStepper'
import { Box } from '@mui/material'
import { accountingBasisBreadCrumbs, steps } from './setting-config'
import PageBreadcrumbs from 'src/components/bread-crumbs/PageBreadcrumbs'
import { paths } from 'src/paths'
import { useNavigate } from 'react-router'
import { useAppDispatch } from 'src/store/hooks'
import { clearAccountingBasisSwitchData } from 'src/store/slices/accountingBasisSwitchSlice'
import { clearPendingPracticePayload } from 'src/store/slices/practiceAccountingBasisSlice'

const AccountingBasisFlow = () => {
  const [activeStep, setActiveStep] = useState<number>(1)
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const handleNext = () => {
    setActiveStep((prev) => Math.min(prev + 1, steps.length - 1))
  }

  const handleBack = () => {
    // setActiveStep((prev) => Math.max(prev - 1, 0))
    dispatch(clearPendingPracticePayload())
    dispatch(clearAccountingBasisSwitchData())
    navigate(paths.settings)
  }

  const commonProps = {
    onNext: handleNext,
    onBack: handleBack,
    activeStep
  }

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return <StepOne {...commonProps} />
      case 1:
        return <StepTwo {...commonProps} />
      case 2:
        return <StepThree {...commonProps} />
      case 3:
        return <StepFour {...commonProps} />
      case 4:
        return <StepFive {...commonProps} />
      default:
        return null
    }
  }

  return (
    <Box className={styles.accountingBasisRoot}>
      <PageBreadcrumbs items={accountingBasisBreadCrumbs} />

      <Box className={styles.container}>
        <Box className={styles.left}>
          <AdaptiveStepper activeStep={activeStep} steps={steps} />
        </Box>

        <Box className={styles.right}>
          <Box className={styles.placeholderBox}>
            {renderStepContent(activeStep)}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default AccountingBasisFlow
