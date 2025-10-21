import React, { useState } from 'react'
import { Box, Typography, Stack } from '@mui/material'
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
      <Box
        className={styles.headerBanner}
        sx={{
          textAlign: { xs: 'center', md: 'left' },
          px: { xs: 2, md: 4 },
          py: { xs: 1.5, md: 2 }
        }}
      >
        <Typography variant='body2' fontSize={{ xs: 13, md: 15 }}>
          <strong>Greyford</strong> practice’s current <b>accounting basis</b>{' '}
          is set to <b>Accrual mode</b>. You can change this mode anytime
          in{' '}
        </Typography>
      </Box>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 2, md: 3 }}
        justifyContent='center'
        alignItems='center'
        className={styles.statsWrapper}
        sx={{
          px: { xs: 2, md: 4 },
          mt: { xs: 2, md: 3 }
        }}
      >
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
      </Stack>

      <Box sx={{ mt: { xs: 2, md: 4 }, px: { xs: 1, md: 3 } }}>
        <ReusableTabs tabs={tabs} initialTab={documentsTabsData[0].key} />
      </Box>
    </Box>
  )
}

export default DocumentsPage
