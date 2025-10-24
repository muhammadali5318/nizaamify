import { AppDispatch } from '../store/store'
import { addFiles } from '../store/slices/uploadSlice'
import { v4 as uuidv4 } from 'uuid'
import { notify } from '../components/notistack/NotificationProvider'

export const handleFileUpload = (
  e: React.ChangeEvent<HTMLInputElement>,
  dispatch: AppDispatch
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
    'xlsm'
  ]

  const maxSize = 10 * 1024 * 1024 // 10MB
  const validFiles = []

  for (const file of selectedFiles) {
    const extension = file.name.split('.').pop()?.toLowerCase()
    const isAllowed = extension ? allowedExtensions.includes(extension) : false
    const isUnderSize = file.size <= maxSize

    if (!isAllowed) {
      notify.error(
        `One or more files could not be uploaded. Supported formats: PDF, PNG, JPG, CSV. ${file.name}`
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
    notify.info('No valid files were added.')
  }

  e.target.value = ''
}
