import React from 'react'
import { Box, Card, CardContent, Typography } from '@mui/material'
import DocumentCategoryCard from '../components/DocumentCategoryCard'
import styles from '../documents.module.scss'
import incomeIcon from '../../../../public/assets/income-icon.svg'
import staffIcon from '../../../../public/assets/staff-icon.svg'
import labIcon from '../../../../public/assets/dental-icon.svg'
import operationsIcon from '../../../../public/assets/business-ops-icon.svg'
import premisesIcon from '../../../../public/assets/premises-icon.svg'
import taxIcon from '../../../../public/assets/tax-icon.svg'
import { useSelector } from 'react-redux'
import { RootState } from 'src/store/store'

const categories = [
  {
    title: 'Income & revenue',
    color: '#007bff',
    icon: incomeIcon,
    examples: [
      'Practice management reports (e.g., Dentally, EXACT rep)',
      'Bank statements',
      'Capitation scheme statements (e.g., Practice Plan)',
      'Subletting or rental income evidence'
    ]
  },
  {
    title: 'Staff costs',
    color: '#ff8c00',
    icon: staffIcon,
    examples: [
      'PAYE payslips',
      'Associate invoices',
      'Hygienist/Therapist invoices',
      'Locum invoices (dentist, therapist, nurse)'
    ]
  },
  {
    title: 'Dental labs & materials ',
    color: '#0284c7',
    icon: labIcon,
    examples: [
      'Dental lab invoices ',
      'Supplier invoices (e.g., consumables, materials) ',
      'Manufacturer receipts '
    ]
  },
  {
    title: 'Business operations',
    color: '#9333ea',
    icon: operationsIcon,
    examples: [
      'Marketing invoices',
      'Software subscriptions',
      'Legal or accountancy fees',
      'Professional indemnity certificates',
      'CQC/GDC-related fees'
    ]
  },
  {
    title: 'Premises & equipment',
    color: '#0284c7',
    icon: premisesIcon,
    examples: [
      'Lease/rent documents',
      'Business rates invoices',
      'Utilities (electricity, gas, water)',
      'Repairs or maintenance bills',
      'Equipment purchases or leasing agreements'
    ]
  },
  {
    title: 'Tax documents ',
    color: '#0284c7',
    icon: taxIcon,
    examples: [
      'Corporation tax statements ',
      'VAT returns ',
      'HMRC communications ',
      'Accountant summaries or filings '
    ]
  }
]

const UploadCategories: React.FC = () => {
  const { completedFiles } = useSelector((state: RootState) => state.uploads)
  const batches = useSelector((state: RootState) => state.processed.batches)
  console.warn(batches)
  const hasBatches = Object.keys(batches || {}).length > 0

  return (
    <>
      {completedFiles.length > 0 || hasBatches ? (
        <Box sx={{ mt: '20px', width: '100%' }}></Box>
      ) : (
        <Box className={styles.documentsPage}>
          <Typography variant='h6' mb={2} mt={2}>
            Document Categories & Examples
          </Typography>
          <Box
            className={styles.practiceInfoBox}
            sx={{
              display: 'flex',
              gap: 2,
              mb: 3,
              flexWrap: 'wrap'
            }}
          >
            <Card
              sx={{
                flex: 1,
                minWidth: '300px',
                backgroundColor: '#F2F9FD'
              }}
            >
              <CardContent>
                <Typography
                  variant='subtitle1'
                  fontWeight='bold'
                  gutterBottom
                  color='#01579B'
                >
                  SQUAT and PRIVATE PRACTICE
                </Typography>
                <Box component='ul' sx={{ pl: 3, m: 0 }}>
                  <li>
                    <Typography variant='body2'>
                      If they are accrual basis: allocated payments report (or
                      equivalent report depending on the software they use)
                    </Typography>
                  </li>
                  <li>
                    <Typography variant='body2'>
                      Cash basis: Income from bank statement
                    </Typography>
                  </li>
                </Box>
              </CardContent>
            </Card>

            <Card
              sx={{ flex: 1, minWidth: '300px', backgroundColor: '#F2F9FD' }}
            >
              <CardContent>
                <Typography
                  variant='subtitle1'
                  fontWeight='bold'
                  gutterBottom
                  color='#01579B'
                >
                  NHS and MIXED
                </Typography>
                <Box component='ul' sx={{ pl: 3, m: 0 }}>
                  <li>
                    <Typography variant='body2'>
                      If they are accrual basis: allocated payments report (or
                      equivalent report depending on the software they use) +
                      NHS compass statement
                    </Typography>
                  </li>
                  <li>
                    <Typography variant='body2'>
                      Cash basis: Income from bank statement
                    </Typography>
                  </li>
                </Box>
              </CardContent>
            </Card>
          </Box>
          <Box className={styles.categoriesGrid}>
            {categories.map((cat, idx) => (
              <DocumentCategoryCard
                key={idx}
                iconColor={cat.color}
                iconSrc={cat.icon}
                title={cat.title}
                examples={cat.examples}
                // onUploadClick={() => alert(`Uploading for ${cat.title}`)}
              />
            ))}
          </Box>
        </Box>
      )}
    </>
  )
}

export default UploadCategories
