import { AppDispatch } from '../store/store'
import { addFiles } from '../store/slices/uploadSlice'
import { v4 as uuidv4 } from 'uuid'
import { notify } from '../components/notistack/NotificationProvider'
import { Workbook } from 'exceljs'

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

  const maxSize = 10 * 1024 * 1024 // 10 MB
  const maxFilesAllowed = 5

  // File count validation
  if (currentFilesCount + selectedFiles.length > maxFilesAllowed) {
    notify.error(
      `You have exceeded the file upload limit. All selected files have been discarded. (Max ${maxFilesAllowed} files allowed at a time.)`
    )
    e.target.value = ''
    return
  }

  // typed array for files to dispatch
  const validFiles: Array<{
    id: string
    name: string
    size: number
    type: string
    file: File
  }> = []

  // extensions considered Excel for multi-sheet check
  const excelExtensions = ['xls', 'xlsx', 'xlsm']

  for (const file of selectedFiles) {
    const extension = file.name.split('.').pop()?.toLowerCase()
    const isAllowed = extension ? allowedExtensions.includes(extension) : false
    const isUnderSize = file.size <= maxSize

    // Extension validation
    if (!isAllowed) {
      notify.error(
        `Unsupported file format: ${file.name}. Allowed: PDF, PNG, JPG, CSV, Excel, Word.`
      )
      continue
    }

    // Size validation
    if (!isUnderSize) {
      notify.warning(`File too large (max 10MB): ${file.name}`)
      continue
    }

    // Excel multi-sheet detection using ExcelJS
    if (extension && excelExtensions.includes(extension)) {
      try {
        // Read file to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer()

        // Create a workbook and load the buffer
        const workbook = new Workbook()

        // workbook.xlsx.load accepts ArrayBuffer / Uint8Array in the browser
        // If this fails in your bundler, see the note below.
        await workbook.xlsx.load(arrayBuffer as any)

        const sheetCount = workbook.worksheets?.length ?? 0

        // Block multi-sheet Excel files
        if (sheetCount > 1) {
          notify.error(
            `Multi-sheet Excel files are not allowed. (${sheetCount} sheets detected in ${file.name})`
          )
          continue
        }
      } catch (err) {
        console.error('Excel read/load failed for', file.name, err)
        notify.error(`Failed to read Excel file: ${file.name}`)
        continue
      }
    }

    // If all validations pass
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

  // Reset input
  e.target.value = ''
}
