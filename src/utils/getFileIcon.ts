import pdfIcon from '../assets/PDF.svg'
import csvIcon from '../assets/CSV.svg'
import pngIcon from '../assets/PNG.svg'
import jpgIcon from '../assets/JPG.svg'
import genericFileIcon from '../../public/assets/document-upload-card-icon.svg' // fallback icon

export const getFileIcon = (fileName: string): string => {
  if (!fileName) return genericFileIcon

  const ext = fileName.split('.').pop()?.toLowerCase() || ''

  switch (ext) {
    case 'pdf':
      return pdfIcon
    case 'csv':
    case 'xls':
    case 'xlsx':
    case 'xlsm':
      return csvIcon
    case 'png':
      return pngIcon
    case 'jpg':
    case 'jpeg':
      return jpgIcon
    default:
      return genericFileIcon
  }
}
