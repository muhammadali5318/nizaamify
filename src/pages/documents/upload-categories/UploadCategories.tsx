import React from 'react'
import { Box, Typography } from '@mui/material'
import DocumentCategoryCard from '../components/DocumentCategoryCard'
import styles from '../documents.module.scss'
import incomeIcon from '../../../../public/assets/income-icon.svg'
import staffIcon from '../../../../public/assets/staff-icon.svg'
import labIcon from '../../../../public/assets/dental-icon.svg'
import operationsIcon from '../../../../public/assets/business-ops-icon.svg'
import premisesIcon from '../../../../public/assets/premises-icon.svg'
// import taxIcon from '../../../../public/assets/tax-icon.svg'
import { useSelector } from 'react-redux'
import { RootState } from 'src/store/store'
import clinicianCostIcon from '../../../assets/clinician-cost-icon.svg'
import materialsIcon from '../../../assets/material-icon.svg'
const categories = [
  {
    title: 'Income & Revenue',
    color: '#007bff',
    icon: incomeIcon,
    examples: [
      'Bank statements',
      'Practice management reports',
      'Capitation scheme statements',
      'Subletting or rental income'
    ]
  },
  {
    title: 'Staff Costs',
    color: '#ff8c00',
    icon: staffIcon,
    examples: [
      'PAYE',
      'Locum/Agency Fees ',
      'Staff training & CPD',
      'Recruitment costs',
      'HR services',
      'Other'
    ]
  },
  {
    title: 'Lab Fees ',
    color: '#0284c7',
    icon: labIcon,
    examples: ['Lab Fees']
  },
  {
    title: 'Business Operations',
    color: '#9333ea',
    icon: operationsIcon,
    examples: [
      'Marketing',
      'Subscriptions',
      'Compliance',
      'Legal/Accounting',
      'IT',
      'Communications',
      'Finance Fees',
      'Miscellaneous Ops'
    ]
  },
  {
    title: 'Premises',
    color: '#0284c7',
    icon: premisesIcon,
    examples: [
      'Lease/Mortgage Payments ',
      'Business Rates',
      'Utilities',
      'Premises Insurance',
      'Repairs/Maintenance (building)',
      'Cleaning Services',
      'Security & Alarm Contracts',
      'Waste disposal',
      'Other'
    ]
  },
  // {
  //   title: 'Tax Documents ',
  //   color: '#0284c7',
  //   icon: taxIcon,
  //   examples: [
  //     'VAT returns',
  //     'HMRC communications',
  //     'Corporation tax statements',
  //     'Accountant summaries or filings'
  //   ]
  // },
  {
    title: 'Clinician Costs',
    color: '#0284c7',
    icon: clinicianCostIcon,
    examples: ['Associate invoices', 'Hygienist/Therapist invoices']
  },
  {
    title: 'Materials & Equipment',
    color: '#0284c7',
    icon: materialsIcon,
    examples: ['Materials', 'Equipment']
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
