import { AppDispatch } from '../store/store'
import { v4 as uuidv4 } from 'uuid'
import { notify } from '../components/notistack/NotificationProvider'
import {
  addBankStatements,
  BankStatementFile
} from 'src/store/slices/bankStatementUploadSlice'

export const handleBankStatementUpload = async (
  e: React.ChangeEvent<HTMLInputElement>,
  dispatch: AppDispatch,
  currentFilesCount: number = 0
) => {
  const selectedFiles = Array.from(e.target.files || [])

  const allowedExtensions = ['csv']
  const maxSize = 10 * 1024 * 1024
  const maxFilesAllowed = 5

  if (currentFilesCount + selectedFiles.length > maxFilesAllowed) {
    notify.error(
      `You have exceeded the file upload limit. Max ${maxFilesAllowed} files allowed.`
    )
    e.target.value = ''
    return
  }

  const validFiles: BankStatementFile[] = []

  for (const file of selectedFiles) {
    const extension = file.name.split('.').pop()?.toLowerCase()
    const isAllowed = extension ? allowedExtensions.includes(extension) : false
    const isUnderSize = file.size <= maxSize

    if (!isAllowed) {
      notify.error(`Unsupported file format: ${file.name}. Allowed: CSV`)
      continue
    }

    if (!isUnderSize) {
      notify.warning(`File too large (max 10MB): ${file.name}`)
      continue
    }

    validFiles.push({
      id: uuidv4(),
      name: file.name,
      size: file.size,
      type: file.type,
      file
    })
  }

  if (validFiles.length > 0) {
    dispatch(addBankStatements(validFiles))
    notify.success(`${validFiles.length} file(s) added successfully`)
  }

  e.target.value = ''
}
