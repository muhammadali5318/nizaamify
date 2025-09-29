import { Box, Divider, Stack, Typography } from '@mui/material'
import styles from './Footer.module.scss'

const Footer = () => {
  return (
    <Box className={styles.footerRoot}>
      <Stack direction={'row'} gap={1.1}>
        <Typography variant='subtitle2' color='var(--color-text-secondary)'>
          Privacy policy
        </Typography>
        <Divider orientation='vertical' flexItem />
        <Typography variant='subtitle2' color='var(--color-text-secondary)'>
          Terms & conditions
        </Typography>
      </Stack>
      <Typography
        variant='subtitle2'
        color='var(--color-text-secondary)'
        align='center'
      >
        Copyright © {new Date().getFullYear()} Monai tech. All rights reserved.
      </Typography>
    </Box>
  )
}

export default Footer
