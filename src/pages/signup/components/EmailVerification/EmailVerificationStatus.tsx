import { Box, Button } from '@mui/material'
import styles from './EmailVerificationStatus.module.scss'
import { ReactNode, MouseEventHandler } from 'react'

type EmailVerificationStatusProps = {
  iconSrc?: string
  iconAlt?: string
  buttonText?: string
  onButtonClick?: MouseEventHandler<HTMLButtonElement>
  children: ReactNode
  footer?: ReactNode
  disabled?: boolean
}

const EmailVerificationStatus = ({
  iconSrc = '/assets/warning.svg',
  iconAlt = 'verification icon',
  buttonText = 'Send new verification email',
  onButtonClick,
  children,
  footer,
  disabled = false
}: EmailVerificationStatusProps) => {
  return (
    <Box className={styles.verificationStatusRoot}>
      <Box>
        <img className={styles.iconDimension} src={iconSrc} alt={iconAlt} />
      </Box>

      <Box className={styles.verificationStatusContainer}>{children}</Box>

      <Box>
        <Button
          className='width--100'
          size='large'
          variant='contained'
          onClick={onButtonClick}
          disabled={disabled}
        >
          {buttonText}
        </Button>
      </Box>

      {footer && (
        <Box className={styles.verificationStatusFooter}>{footer}</Box>
      )}
    </Box>
  )
}

export default EmailVerificationStatus
