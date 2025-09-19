import { Box, Typography } from '@mui/material'
import styles from './ChooseNominationcard.module.scss'

type ChooseNominationCardProps = {
  heading: string
  description: string
  imagePath: string
  alt: string
  onClick?: () => void
}

const ChooseNominationCard: React.FC<ChooseNominationCardProps> = ({
  heading,
  description,
  imagePath,
  alt,
  onClick
}) => {
  return (
    <Box className={styles.chooseNominationCardRoot} onClick={onClick}>
      <Box>
        <img src={imagePath} alt={alt} />
      </Box>
      <Box>
        <Typography variant='h6' className='font-weight--700'>
          {heading}
        </Typography>
        <Typography variant='body2' color='var(--color-text-secondary)'>
          {description}
        </Typography>
      </Box>
    </Box>
  )
}

export default ChooseNominationCard
