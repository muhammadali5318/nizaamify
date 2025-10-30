import React, { useRef } from 'react'
import { Card, Typography, List, ListItem, Button, Box } from '@mui/material'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../../store/store'
import { handleFileUpload } from '../../../utils/handleFileUpload'
import { ImgIcon } from '../../../components/common/ImgIcon'
import styles from './DocumentCategoryCard.module.scss'

export interface DocumentCategoryCardProps {
  iconColor: string
  iconSrc?: string
  title: string
  examples: string[]
}

const DocumentCategoryCard: React.FC<DocumentCategoryCardProps> = ({
  iconSrc,
  title,
  examples
}) => {
  const dispatch = useDispatch()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { files } = useSelector((state: RootState) => state.uploads)

  const handleButtonClick = () => {
    if (files.length < 5) {
      fileInputRef.current?.click()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(e, dispatch, files.length)
  }

  return (
    <Card className={styles.categoryCard}>
      <Box className={styles.header}>
        <Box
          className={styles.iconWrapper}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            width: 48,
            height: 48
          }}
        >
          {iconSrc ? (
            <ImgIcon src={iconSrc} alt={title} size={40} />
          ) : (
            <span className={styles.fallbackIcon}>📁</span>
          )}
        </Box>
        <Typography variant='h6' className={styles.title}>
          {title}
        </Typography>
      </Box>

      <List className={styles.examples}>
        {examples.map((example, idx) => (
          <ListItem key={idx} disablePadding className={styles.exampleItem}>
            • {example}
          </ListItem>
        ))}
      </List>

      <Box display='flex' justifyContent='flex-start'>
        <Button
          variant='contained'
          color='inherit'
          className={styles.uploadBtn}
          onClick={handleButtonClick}
          disabled={files.length >= 5}
        >
          {files.length >= 5 ? 'Limit Reached (5/5)' : 'Upload files →'}
        </Button>

        {/* Hidden input for file selection */}
        <input
          type='file'
          multiple
          hidden
          ref={fileInputRef}
          onChange={handleChange}
        />
      </Box>
    </Card>
  )
}

export default DocumentCategoryCard
