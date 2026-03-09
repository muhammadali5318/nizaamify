// eslint-disable-next-line import/no-named-as-default
import html2canvas from 'html2canvas-pro'
// eslint-disable-next-line import/no-named-as-default
import jsPDF from 'jspdf'
import dayjs from 'dayjs'

export const downloadDashboardPDF = async (
  dashboardRef: React.RefObject<HTMLElement>,
  feedbackRef: React.RefObject<HTMLElement>,
  fileNamePrefix: string = 'Dashboard'
) => {
  if (!dashboardRef.current) return

  await new Promise((resolve) => setTimeout(resolve, 300))

  const pdf = new jsPDF('p', 'mm', 'a4')

  const pageWidth = pdf.internal.pageSize.getWidth()
  const padding = 10
  const usableWidth = pageWidth - padding * 2

  // -------- Dashboard Page --------
  const dashboardCanvas = await html2canvas(dashboardRef.current, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#fff'
  })

  const dashboardImg = dashboardCanvas.toDataURL('image/png')

  const dashboardHeight =
    (dashboardCanvas.height * usableWidth) / dashboardCanvas.width

  pdf.addImage(
    dashboardImg,
    'PNG',
    padding,
    padding,
    usableWidth,
    dashboardHeight
  )

  // -------- Feedback Page --------
  if (feedbackRef?.current) {
    const feedbackCanvas = await html2canvas(feedbackRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#fff'
    })

    const feedbackImg = feedbackCanvas.toDataURL('image/png')

    const feedbackHeight =
      (feedbackCanvas.height * usableWidth) / feedbackCanvas.width

    pdf.addPage()

    pdf.addImage(
      feedbackImg,
      'PNG',
      padding,
      padding,
      usableWidth,
      feedbackHeight
    )
  }

  const date = dayjs().format('DD-MM-YYYY')
  const fileName = `${fileNamePrefix}-${date}.pdf`

  pdf.save(fileName)
}
