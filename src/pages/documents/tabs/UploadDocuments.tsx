import { Box } from '@mui/material'
import DocumentUploadBox from '../components/DocumentUploadBox'
import UploadCategories from '../upload-categories/UploadCategories'
import styles from '../documents.module.scss'
import ManualEntryCard from '../components/ManualEntryCard'
import UploadDocumentCard from '../components/UploadDocumentCard'
const UploadDocuments = () => {
  return (
    <div>
      {' '}
      <ManualEntryCard onStart={() => console.log('Manual entry started')} />
      <Box className={styles.uploadSection}>
        <UploadDocumentCard />

        <DocumentUploadBox />
      </Box>
      {/* Document Categories */}
      <UploadCategories />
    </div>
  )
}

export default UploadDocuments
