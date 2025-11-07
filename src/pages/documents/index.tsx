// src/pages/Documents/DocumentsPage.tsx  (or wherever your file lives)
import React from 'react'
import { Box, Typography, Stack, Link } from '@mui/material'
import styles from './documents.module.scss'
import StatsCard from 'src/components/team-management/StatsCard'
import { ReusableTabs } from 'src/components/tabs'
import useDocumentsTabs from './hooks/useDocumentsTabs'
import {
  documentsModuleBreadCrumbs,
  documentsTabsData
} from './config/documentsConfig'
import { useInitialData } from '../../hooks/useFetchInitialData'
import { Outlet, useLocation, useNavigate } from 'react-router'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import PageBreadcrumbs from 'src/components/bread-crumbs/PageBreadcrumbs'
import { useActivePractice } from 'src/hooks/useActivePractice'
import { useHasPermission } from 'src/config/module-permissions'
import useDocumentCounts from './hooks/useDocumentCounts'

const DocumentsPage: React.FC = () => {
  const tabs = useDocumentsTabs()
  const navigate = useNavigate()
  const { data, isLoading, isError } = useInitialData(true)
  const { activePracticeId } = useActivePractice()
  const canViewDocuments = useHasPermission('data.upload_archive')

  const { data: counts } = useDocumentCounts(
    activePracticeId,
    !!canViewDocuments
  )

  const practiceName = data?.practice_name || 'Your'
  const location = useLocation()
  const isSubRoute = location.pathname === '/documents/manual-entry'

  const handleNavigateToSettings = () => navigate('/settings')

  const toTitleCase = (text: string) =>
    text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : ''

  const accountingBasis = toTitleCase(data?.accounting_basis || 'N/A')

  // derive stats safely
  const stats = {
    all: counts?.all ?? 0,
    uploaded: counts?.uploaded ?? 0,
    review: counts?.review ?? 0
  }

  return (
    <Box className={styles.documentsRoot}>
      <PageBreadcrumbs items={documentsModuleBreadCrumbs} />
      {!isSubRoute ? (
        <>
          <Box
            className={styles.headerBanner}
            sx={{
              textAlign: { xs: 'center', md: 'left' },
              color: '#01579B',
              backgroundColor: '#F2F9FC',
              width: '100%',
              border: '1px solid #0288D1',
              borderRadius: '16px'
            }}
          >
            {isLoading ? (
              <Typography variant='body2'>
                Loading practice details...
              </Typography>
            ) : isError ? (
              <Typography color='error' variant='body2'>
                Failed to load practice details
              </Typography>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: '6px'
                }}
              >
                <Box paddingTop='4px' color='#0288D1'>
                  <ErrorOutlineIcon />
                </Box>
                <Typography variant='body2' fontSize={{ xs: 13, md: 15 }}>
                  <strong>{practiceName}</strong> practice’s current{' '}
                  <b>accounting basis</b> is set to{' '}
                  <span
                    style={{
                      color: '#01579B',
                      fontWeight: 'bold'
                    }}
                  >
                    {accountingBasis} mode.
                  </span>{' '}
                  You can change this mode anytime in
                  <Link
                    component='button'
                    onClick={handleNavigateToSettings}
                    sx={{
                      color: '#01579B',
                      fontWeight: 'bold',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      marginLeft: '4px',
                      marginBottom: '3px'
                    }}
                  >
                    Settings
                  </Link>
                </Typography>
              </Box>
            )}
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
          </Stack>

          <Box /* tabs wrapper props */>
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
