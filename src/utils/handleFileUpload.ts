import { AppDispatch } from '../store/store'
import { addFiles } from '../store/slices/uploadSlice'
import { v4 as uuidv4 } from 'uuid'
import { notify } from '../components/notistack/NotificationProvider'
import * as XLSX from 'xlsx'

export const handleFileUpload = async (
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
  const maxFilesAllowed = 5

  // 🚫 File count validation
  if (currentFilesCount + selectedFiles.length > maxFilesAllowed) {
    notify.error(
      `You have exceeded the file upload limit. All selected files have been discarded. (Max ${maxFilesAllowed} files allowed at a time.)`
    )
    e.target.value = ''
    return
  }

  const validFiles = []

  for (const file of selectedFiles) {
    const extension = file.name.split('.').pop()?.toLowerCase()
    const isAllowed = extension ? allowedExtensions.includes(extension) : false
    const isUnderSize = file.size <= maxSize

    // 🚫 Extension validation
    if (!isAllowed) {
      notify.error(
        `Unsupported file format: ${file.name}. Allowed: PDF, PNG, JPG, CSV, Excel, Word.`
      )
      continue
    }

    // 🚫 Size validation
    if (!isUnderSize) {
      notify.warning(`File too large (max 10MB): ${file.name}`)
      continue
    }

    // ✅ Excel multi-sheet detection
    if (['xls', 'xlsx', 'xlsm'].includes(extension || '')) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        const sheetCount = workbook.SheetNames.length

        // 🚫 Block multi-sheet Excel files
        if (sheetCount > 1) {
          notify.error(
            `Multi-sheet Excel files are not allowed. (${sheetCount} sheets detected in ${file.name})`
          )
          continue
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        notify.error(`Failed to read Excel file: ${file.name}`)
        continue
      }
    }

    // ✅ If all validations pass
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
