import React from 'react'
import { Box, Typography } from '@mui/material'
import DocumentCategoryCard from '../components/DocumentCategoryCard'
import styles from '../documents.module.scss'
import incomeIcon from '../../../../public/assets/income-icon.svg'
import staffIcon from '../../../../public/assets/staff-icon.svg'
import labIcon from '../../../../public/assets/dental-icon.svg'
import operationsIcon from '../../../../public/assets/business-ops-icon.svg'
import premisesIcon from '../../../../public/assets/premises-icon.svg'
import taxIcon from '../../../../public/assets/tax-icon.svg'

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
  return (
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
            onUploadClick={() => alert(`Uploading for ${cat.title}`)}
          />
        ))}
      </Box>
    </Box>
  )
}

export default UploadCategories
