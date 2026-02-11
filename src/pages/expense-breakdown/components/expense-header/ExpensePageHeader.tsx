import { Box, Button } from '@mui/material'
import ModuleHeader from 'src/components/module-header'
import DateRangeSelector from 'src/components/date-range-selector'
import { ExpenseHeaderProps } from '../../types'
import { downloadCsv } from '../helper'
import html2canvas from 'html2canvas-pro'
// eslint-disable-next-line import/no-named-as-default
import jsPDF from 'jspdf'
import dayjs from 'dayjs'
import { useState } from 'react'

const ExpensePageHeader = ({
  avatarSrc,
  heading,
  dateRange,
  onDateChange,
  subheading,
  data,
  allExpanded,
  setAllExpanded,
  pdfRef,
  showDownloadBtn = true
}: ExpenseHeaderProps) => {
  const [loadingPDF, setLoadingPDF] = useState(false)

  const handleDownloadPDF = async () => {
    if (!data || !pdfRef?.current) return

    setLoadingPDF(true)
    const prevExpanded = allExpanded

    try {
      // eslint-disable-next-line promise/param-names
      await new Promise((r) => setTimeout(r, 1000))

      const element = pdfRef.current

      const pdfPadding = 6
      const headerHeight = 24 // space for title + date
      const extraBottomPx = 40

      const fullCanvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        scrollY: -window.scrollY,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight + extraBottomPx
      })

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [210, 420]
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      const usableWidth = pageWidth - pdfPadding * 2
      const usableHeight = pageHeight - pdfPadding * 2 - headerHeight

      const scale = usableWidth / fullCanvas.width
      const pageCanvasHeightPx = usableHeight / scale

      const title = 'Expense Breakdown'
      const subtitle =
        'Detailed view of all expense categories and subcategories'

      const selectedDate =
        dateRange?.start && dateRange?.end
          ? `${dayjs(dateRange.start).format('DD MMM YYYY')} - ${dayjs(
              dateRange.end
            ).format('DD MMM YYYY')}`
          : ''

      let currentY = 0
      let pageIndex = 0

      while (currentY < fullCanvas.height) {
        if (pageIndex > 0) pdf.addPage()

        // 🔹 HEADER (manual)
        if (pageIndex === 0) {
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(16)
          pdf.text(title, pdfPadding, 14)

          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(11)
          pdf.text(subtitle, pdfPadding, 20)

          if (selectedDate) {
            pdf.setFontSize(13) // ⬅️ increased date size
            pdf.text(
              `Date range: ${selectedDate}`,
              pageWidth - pdfPadding,
              14,
              { align: 'right' }
            )
          }
        }

        // 🔹 PAGE SLICE
        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = fullCanvas.width
        pageCanvas.height = Math.min(
          pageCanvasHeightPx,
          fullCanvas.height - currentY
        )

        const ctx = pageCanvas.getContext('2d')
        if (!ctx) break

        ctx.drawImage(
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

        const topOffset =
          pageIndex === 0 ? pdfPadding + headerHeight : pdfPadding

        pdf.addImage(
          imgData,
          'PNG',
          pdfPadding,
          topOffset,
          usableWidth,
          imgHeight
        )

        currentY += pageCanvasHeightPx
        pageIndex++
      }

      const date = dayjs().format('DD-MM-YYYY')
      pdf.save(`ExpenseBreakdown-${date}.pdf`)
    } finally {
      // keep loader until collapse finishes
      setLoadingPDF(false)
      setAllExpanded(prevExpanded) // collapse accordions
    }
  }

  const handlePdfClick = () => {
    setLoadingPDF(true)
    setAllExpanded(true)

    setTimeout(() => {
      handleDownloadPDF()
    }, 1000)
  }

  return (
    <>
      <Box
        sx={{
          p: 2,
          paddingBottom: '0px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          flexWrap: 'wrap',
          rowGap: 2,
          '@media (max-width: 600px)': {
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 2
          }
        }}
      >
        <ModuleHeader
          avatarSrc={avatarSrc}
          heading={heading}
          subheading={subheading}
        />

        <Box
          sx={{
            width: { xs: '100%', sm: 'auto' },
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            position: 'relative'
          }}
        >
          <Box
            sx={{
              '& .MuiInputBase-root': {
                height: 40,
                width: 270
              },
              '& input': {
                padding: '8px 0px 8px 12px'
              }
            }}
          >
            <DateRangeSelector
              label='Select date range'
              value={dateRange}
              onChange={onDateChange}
            />
          </Box>
        </Box>
      </Box>
      {showDownloadBtn && (
        <Box
          display={'flex'}
          gap={1.5}
          justifyContent={'flex-end'}
          width={'100%'}
        >
          <Button
            variant='contained'
            onClick={() => downloadCsv(data)}
            disabled={!data}
            sx={{
              height: 40,
              alignSelf: 'center',
              whiteSpace: 'nowrap'
            }}
          >
            Download CSV
          </Button>

          <Button
            variant='outlined'
            onClick={handlePdfClick}
            disabled={!data || loadingPDF}
            sx={{
              height: 40,
              alignSelf: 'center',
              whiteSpace: 'nowrap'
            }}
          >
            {loadingPDF ? 'Generating PDF...' : 'Download PDF'}
          </Button>
        </Box>
      )}
    </>
  )
}

export default ExpensePageHeader
