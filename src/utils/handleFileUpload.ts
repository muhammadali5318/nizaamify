import { AppDispatch } from '../store/store'
import { addFiles } from '../store/slices/uploadSlice'
import { v4 as uuidv4 } from 'uuid'
import { notify } from '../components/notistack/NotificationProvider'

export const handleFileUpload = (
  e: React.ChangeEvent<HTMLInputElement>,
  dispatch: AppDispatch,
  currentFilesCount: number = 0
) => {
  const selectedFiles = Array.from(e.target.files || [])

  const allowedExtensions = [
    'csv',
    'pdf',
    'png',
    'jpg',
    'jpeg',
    'xls',
    'xlsx',
    'xlsm',
    'doc',
    'docx'
  ]

  const maxSize = 10 * 1024 * 1024

  if (currentFilesCount + selectedFiles.length > 5) {
    notify.error(
      `You have exceeded the file upload limit. All selected files have been discarded. (Max 5 files allowed at a time.)`
    )
    e.target.value = ''
    return
  }

  const validFiles = []

  for (const file of selectedFiles) {
    const extension = file.name.split('.').pop()?.toLowerCase()
    const isAllowed = extension ? allowedExtensions.includes(extension) : false
    const isUnderSize = file.size <= maxSize

    if (!isAllowed) {
      notify.error(
        `Unsupported file format: ${file.name}. Allowed: PDF, PNG, JPG, CSV.`
      )
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
    dispatch(addFiles(validFiles))
    notify.success(`${validFiles.length} file(s) added successfully`)
  } else {
    console.warn('No valid files were added.')
  }

  e.target.value = ''
}
