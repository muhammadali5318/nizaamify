import html2canvas from 'html2canvas-pro'
import jsPDF from 'jspdf'
import dayjs from 'dayjs'

export const downloadDashboardPDF = async (
  elementRef: React.RefObject<HTMLElement>,
  fileNamePrefix: string = 'Dashboard'
) => {
  if (!elementRef.current) return

  const element = elementRef.current

  // Allow charts to finish rendering
  await new Promise((resolve) => setTimeout(resolve, 250))

  const pdfPadding = 10 // mm padding

  // Capture entire dashboard
  const fullCanvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff'
  })

  const pdf = new jsPDF('p', 'mm', 'a4')

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  const usableWidth = pageWidth - pdfPadding * 2
  const usableHeight = pageHeight - pdfPadding * 2

  // Scale factor to convert canvas px → PDF mm
  const scale = usableWidth / fullCanvas.width
  const pageCanvasHeightPx = usableHeight / scale

  let currentY = 0

  while (currentY < fullCanvas.height) {
    // Create temporary canvas for the chunk
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = fullCanvas.width
    pageCanvas.height = Math.min(
      pageCanvasHeightPx,
      fullCanvas.height - currentY
    )

    const pageCtx = pageCanvas.getContext('2d')
    if (!pageCtx) break

    // Copy chunk of full canvas
    pageCtx.drawImage(
      fullCanvas,
      0,
      currentY,
      fullCanvas.width,
      pageCanvas.height,
      0,
      0,
      fullCanvas.width,
      pageCanvas.height
    )

    const imgData = pageCanvas.toDataURL('image/png', 1.0)
    const imgHeight = pageCanvas.height * scale

    pdf.addImage(imgData, 'PNG', pdfPadding, pdfPadding, usableWidth, imgHeight)

    currentY += pageCanvasHeightPx

    if (currentY < fullCanvas.height) pdf.addPage()
  }

  const date = dayjs().format('DD-MM-YYYY')
  const fileName = `${fileNamePrefix}-${date}.pdf`

  pdf.save(fileName)
}
