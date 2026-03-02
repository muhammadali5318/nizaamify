import { Box, Stack } from '@mui/material'
import FileUploadBox from '../documents/components/DocumentUploadBox'
import styles from './documents.module.scss'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from 'src/store/store'
import { handleBankStatementUpload } from 'src/utils/handleBankStatementUpload'
import uploadIcon from '../../assets/upload-box-icon.svg'
import ModuleHeader from 'src/components/module-header'
import PageBreadcrumbs from 'src/components/bread-crumbs/PageBreadcrumbs'
import { uploadCsvBreads } from './bank-integrator-config'
import UploadQueue from './components/upload-bank-statement-completed/UploadQueue'
import ProcessingCompletedListForStatement from '../documents/components/ProcessingCompletedListForStatement'

const UploadBankStatement = () => {
  const dispatch = useDispatch()
  const { bankStatements, completedBankStatements } = useSelector(
    (state: RootState) => state.bankStatementUploads
  )

  const batches = useSelector(
    (state: RootState) => state.processedBankStatement.batches
  )

  const hasBatches = Object.keys(batches || {}).length > 0

  const handleFilesSelected = (selectedFiles: FileList) => {
    const event = {
      target: { files: selectedFiles }
    } as unknown as React.ChangeEvent<HTMLInputElement>
    handleBankStatementUpload(event, dispatch, bankStatements.length)
  }
  return (
    <Stack
      spacing={2.5}
      sx={{
        py: 3,
        px: {
          xs: 2,
          sm: 4,
          md: 10,
          lg: 20
        }
      }}
    >
      <PageBreadcrumbs items={uploadCsvBreads} />
      <Box className={styles.uploadSection}>
        <ModuleHeader
          avatarSrc='/assets/document-upload-card-icon.svg'
          heading='Upload Bank Statement'
          subheading='Upload your Bank Statement. System will extract the transactions and will ask you to categorise them. It will then learn those for future use.'
        />
        <FileUploadBox
          title='Upload or drag and drop your financial documents'
          fileInfoText='Maximum File Size is 10MB. Supported File Types are: .CSV, .PDF'
          maxFiles={5}
          fileCount={bankStatements?.length}
          isProcessingComplete={
            completedBankStatements?.length > 0 || hasBatches
          }
          completedView={<ProcessingCompletedListForStatement />}
          onFilesSelected={handleFilesSelected}
          uploadIcon={uploadIcon}
          fileTypeIcon='/assets/pdf-svg.svg'
        />
        {completedBankStatements?.length > 0 || hasBatches ? (
          ''
        ) : (
          <UploadQueue />
        )}
      </Box>
    </Stack>
  )
}

export default UploadBankStatement
