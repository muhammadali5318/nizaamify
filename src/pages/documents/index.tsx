// src/pages/Documents/DocumentsPage.tsx  (or wherever your file lives)
import React from 'react'
import { Box } from '@mui/material'
import styles from './documents.module.scss'
import StatsCard from 'src/components/team-management/StatsCard'
import { ReusableTabs } from 'src/components/tabs'
import useDocumentsTabs from './hooks/useDocumentsTabs'
import {
  documentsModuleBreadCrumbs,
  documentsTabsData
} from './config/documentsConfig'
import { Outlet, useLocation } from 'react-router'
import PageBreadcrumbs from 'src/components/bread-crumbs/PageBreadcrumbs'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { useHasPermission } from 'src/config/module-permissions'
import useDocumentCounts from './hooks/useDocumentCounts'

const DocumentsPage: React.FC = () => {
  const tabs = useDocumentsTabs()
  const { activePracticeId } = useActivePractice()
  const canViewDocuments = useHasPermission('data.upload_archive')

  const { data: counts } = useDocumentCounts(
    activePracticeId,
    !!canViewDocuments
  )

  const location = useLocation()
  const isSubRoute = location.pathname === '/documents/manual-entry'

  // derive stats safely
  const stats = {
    all: counts?.all ?? 0,
    uploaded: counts?.uploaded ?? 0,
    review: counts?.review ?? 0
  }

  return (
    <Box className={styles.documentsRoot}>
      <PageBreadcrumbs
        items={
          location.pathname === '/documents/manual-entry'
            ? [
                { label: 'Documents', to: '/documents' },
                { label: 'Manual entries' }
              ]
            : documentsModuleBreadCrumbs
        }
      />
      {!isSubRoute ? (
        <>
          <Box
            flexDirection={{ xs: 'column', md: 'row', lg: 'row' }}
            gap={{ xs: 2, md: 3 }}
            justifyContent={{
              xs: 'flex-start',
              md: 'flex-start',
              lg: 'flex-start'
            }}
            alignItems='center'
            className={styles.statsWrapper}
            sx={{
              width: { xs: '96%', sm: '100%', md: '99%', lg: '96%' }
            }}
          >
            <StatsCard
              iconSrc='team-member.svg'
              label='All practice documents'
              value={stats.all}
              sx={{ minHeight: '17vh' }}
            />
            <StatsCard
              iconSrc='active-member.svg'
              label='Your uploaded documents'
              value={stats.uploaded}
              sx={{ minHeight: '17vh' }}
            />
            <StatsCard
              iconSrc='pending-member.svg'
              label='Documents requiring review'
              value={stats.review}
              sx={{ minHeight: '17vh' }}
            />
          </Box>

          <Box
            sx={{
              width: {
                xs: '100%',
                sm: '94%',
                md: '94%',
                lg: '97%',
                xl: '97%'
              }
            }}
          >
            <ReusableTabs tabs={tabs} initialTab={documentsTabsData[0].key} />
          </Box>
        </>
      ) : (
        <Outlet />
      )}
    </Box>
  )
}

export default DocumentsPage
