import styles from './submitFeedback.module.scss'
import { Box } from '@mui/material'
import Support from './Support'
import FeedbackType from './FeedbackType'

const SubmitFeedback = () => {
  return (
    <Box className={styles.submitFeedbackRoot}>
      <Support
        avatarSrc='/assets/feedback-icon.svg'
        heading='Submit Feedback'
        subheading='Share your thoughts with us'
      >
        <Box
          display='flex'
          gap={1.5}
          alignSelf='stretch'
          width='100%'
          flexDirection={{ xs: 'column', md: 'row' }}
        >
          <FeedbackType
            label='Bug Reports'
            borderColor='#D32F2F'
            bgColor='rgba(211, 47, 47, 0.04)'
            icon={<img src='/assets/danger-warn.svg' alt='danger' />}
            typographyProps={{
              variant: 'body2'
            }}
          />
          <FeedbackType
            label='Improvements'
            borderColor='#9C27B0'
            bgColor='rgba(156, 39, 176, 0.04)'
            icon={<img src='/assets/seconday-elec.svg' alt='seconday-elec' />}
            typographyProps={{
              variant: 'body2'
            }}
          />
        </Box>
        <Box
          display='flex'
          gap={1.5}
          alignSelf='stretch'
          width='100%'
          flexDirection={{ xs: 'column', md: 'row' }}
        >
          <FeedbackType
            label='General'
            borderColor='#0288D1'
            bgColor='#E6F1F7'
            icon={<img src='/assets/chat.svg' alt='chat icon' />}
            typographyProps={{
              variant: 'body2'
            }}
          />
          <FeedbackType
            label='Feature Ideas'
            borderColor='#2E7D32'
            bgColor='rgba(46, 125, 50, 0.04)'
            icon={<img src='/assets/insight.svg' alt='insight icon' />}
            typographyProps={{
              variant: 'body2'
            }}
          />
        </Box>
      </Support>
      <Support
        avatarSrc='/assets/feedback-icon.svg'
        heading='Contact Support'
        subheading='Get help from our support team'
      />
    </Box>
  )
}

export default SubmitFeedback
