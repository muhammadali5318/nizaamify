import { Box, Typography } from '@mui/material'
import styles from './Topbar.module.scss'

type topbarProps = {
  title: string
  icon: string
}

const Topbar: React.FC<topbarProps> = ({ title, icon }) => {
  return (
    <Box className={styles.topbar}>
      <Box className={styles.topbarTitleContainer}>
        <img src={`/assets/${icon}`} alt={`${icon} actice icon`} />
        <Typography variant='h5' className='font-weight--700'>
          {title}
        </Typography>
      </Box>
      <Box className={styles.topbarActionContainer}>
        <img src='/assets/search.svg' alt='search icon' />
        <img src='/assets/notification.svg' alt='Notification icon' />

        <Box className={styles.profileTitle}>
          <Typography variant='body1' className='font-weight--700'>
            Muhammad Ali
          </Typography>
          <Typography
            variant='caption'
            color='var(--color-primary-light)'
            className='font-weight--700'
          >
            Pratice Admin
          </Typography>
        </Box>
        <img src='/assets/profile-avatar.svg' alt='profile avatar' />
      </Box>
    </Box>
  )
}

export default Topbar
