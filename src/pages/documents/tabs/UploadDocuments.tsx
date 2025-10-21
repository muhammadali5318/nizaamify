import { Box } from '@mui/material'
import DocumentUploadBox from '../components/DocumentUploadBox'
import UploadQueue from '../components/UploadQueue'
import UploadCategories from '../upload-categories/UploadCategories'
import styles from '../documents.module.scss'
import ManualEntryCard from '../components/ManualEntryCard'
import UploadDocumentCard from '../components/UploadDocumentCard'

const UploadDocuments = () => {
  return (
    <div>
      <ManualEntryCard onStart={() => console.warn('Manual entry started')} />

      <Box className={styles.uploadSection}>
        <UploadDocumentCard />
        <DocumentUploadBox />
      </Box>

      <UploadQueue />

      <UploadCategories />
    </div>
  )
}

export default UploadDocuments
