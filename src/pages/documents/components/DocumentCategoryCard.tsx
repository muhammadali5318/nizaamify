import React from 'react'
import { Card, Typography, List, ListItem, Button, Box } from '@mui/material'
import { ImgIcon } from '../../../components/common/ImgIcon' // adjust path if needed
import styles from './DocumentCategoryCard.module.scss'

export interface DocumentCategoryCardProps {
  iconColor: string
  iconSrc?: string
  title: string
  examples: string[]
  onUploadClick?: () => void
}

const DocumentCategoryCard: React.FC<DocumentCategoryCardProps> = ({
  iconSrc,
  title,
  examples,
  onUploadClick
}) => {
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

      <Button
        variant='contained'
        color='inherit'
        className={styles.uploadBtn}
        onClick={onUploadClick}
      >
        Upload files →
      </Button>
    </Card>
  )
}

export default DocumentCategoryCard
