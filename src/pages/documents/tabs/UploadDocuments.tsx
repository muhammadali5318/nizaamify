import { Box } from '@mui/material'
import UploadQueue from '../components/UploadQueue'
import UploadCategories from '../upload-categories/UploadCategories'
import styles from '../documents.module.scss'
import ManualEntryCard from '../components/ManualEntryCard'
import UploadDocumentCard from '../components/UploadDocumentCard'
import { useNavigate } from 'react-router'
import FileUploadBox from '../components/DocumentUploadBox'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from 'src/store/store'
import { handleFileUpload } from 'src/utils/handleFileUpload'
import ProcessingCompletedList from '../components/ProcessingCompletedList'
import uploadIcon from '../../../assets/upload-box-icon.svg'
import fileimage from '../../../assets/upload-file-combined-icon.svg'
import { useResumePolling } from 'src/utils/autoResumePollingJob'
const UploadDocuments = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { files, completedFiles } = useSelector(
    (state: RootState) => state.uploads
  )
  const batches = useSelector((state: RootState) => state.processed.batches)
  const hasBatches = Object.keys(batches || {}).length > 0

  const handleFilesSelected = (selectedFiles: FileList) => {
    const event = {
      target: { files: selectedFiles }
    } as unknown as React.ChangeEvent<HTMLInputElement>
    handleFileUpload(event, dispatch, files.length)
  }
  const handleManualEntryClick = () => {
    navigate('manual-entry')
  }

  useResumePolling()

  return (
    <Box
    // sx={{
    //   width: { xs: '100%', sm: '94%', md: '94%', lg: '100%', xl: '100%' }
    // }}
    >
      <ManualEntryCard onClick={handleManualEntryClick} />

      <Box className={styles.uploadSection}>
        <UploadDocumentCard />
        <FileUploadBox
          title='Upload or drag and drop your financial documents'
          subtitle='You can upload unlimited files but only 5 in one go.'
          fileInfoText='Maximum 10MB each — Supported: .CSV, .PDF, .PNG, .JPG, .DOC'
          maxFiles={5}
          fileCount={files?.length}
          isProcessingComplete={completedFiles?.length > 0 || hasBatches}
          completedView={<ProcessingCompletedList />}
          onFilesSelected={handleFilesSelected}
          uploadIcon={uploadIcon}
          fileTypeIcon={fileimage}
        />
        {completedFiles?.length > 0 || hasBatches ? '' : <UploadQueue />}
      </Box>

      <UploadCategories />
    </Box>
  )
}

export default UploadDocuments
