import { Box } from '@mui/material'
import styles from './traningModule.module.scss'
import ModuleHeader from 'src/components/module-header'
import TrainingVideoCard from './TrainingVideoCard'

const videos = [
  {
    thumbnail: '/assets/monai-white.svg',
    title: 'Getting Started with Monai',
    description: 'Learn how to set up and navigate Monai in minutes.',
    duration: '3:45'
  },
  {
    thumbnail: '/assets/video-thumb-2.jpg',
    title: 'Managing Your Practice',
    description: 'Understand how Monai simplifies daily operations.',
    duration: '5:10'
  },
  {
    thumbnail: '/assets/video-thumb-2.jpg',
    title: 'Managing Your Practice',
    description: 'Understand how Monai simplifies daily operations.',
    duration: '5:10'
  },
  {
    thumbnail: '/assets/video-thumb-2.jpg',
    title: 'Managing Your Practice',
    description: 'Understand how Monai simplifies daily operations.',
    duration: '5:10'
  },
  {
    thumbnail: '/assets/video-thumb-2.jpg',
    title: 'Managing Your Practice',
    description: 'Understand how Monai simplifies daily operations.',
    duration: '5:10'
  },
  {
    thumbnail: '/assets/video-thumb-2.jpg',
    title: 'Managing Your Practice',
    description: 'Understand how Monai simplifies daily operations.',
    duration: '5:10'
  },
  {
    thumbnail: '/assets/video-thumb-2.jpg',
    title: 'Managing Your Practice',
    description: 'Understand how Monai simplifies daily operations.',
    duration: '5:10'
  }
]

const TraningModule = () => {
  return (
    <Box className={styles.traningModuleRoot}>
      <ModuleHeader
        avatarSrc='/assets/video-rounded.svg'
        heading='Learn With Monai'
        subheading='Short videos that explain how Monai Tech simplifies your operations'
        subheadingVariant='subtitle2'
        gap={0}
      />

      {/* use CSS Grid via className */}
      <Box className={styles.videosGrid} p={2}>
        {videos.map((video, index) => (
          <TrainingVideoCard key={index} {...video} />
        ))}
      </Box>
    </Box>
  )
}

export default TraningModule
