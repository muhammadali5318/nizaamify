import React, { useState } from 'react'
import { Box, Typography } from '@mui/material'
import styles from './documents.module.scss'
import StatsCard from 'src/components/team-management/StatsCard'
import { ReusableTabs } from 'src/components/tabs'
import useDocumentsTabs from './hooks/useDocumentsTabs'
import { documentsTabsData } from './config/documentsConfig'

const DocumentsPage: React.FC = () => {
  const [stats] = useState({
    all: 3,
    uploaded: 3,
    review: 3
  })
  const tabs = useDocumentsTabs()
  return (
    <Box className={styles.documentsRoot}>
      <Box className={styles.headerBanner}>
        <Typography variant='body2'>
          <strong>Greyford</strong> practice’s current <b>accounting basis</b>{' '}
          is set to <b>Accrual mode</b>. You can change this mode anytime in{' '}
          <a href='#'>Settings</a>.
        </Typography>
      </Box>

      <Box className={styles.statsWrapper}>
        <StatsCard
          iconSrc='team-member.svg'
          label='All practice documents'
          value={stats.all}
        />
        <StatsCard
          iconSrc='active-member.svg'
          label='Your uploaded documents'
          value={stats.uploaded}
        />
        <StatsCard
          iconSrc='pending-member.svg'
          label='Documents requiring review'
          value={stats.review}
        />
      </Box>
      <ReusableTabs tabs={tabs} initialTab={documentsTabsData[0].key} />
    </Box>
  )
}

export default DocumentsPage
