import { Box, Button } from '@mui/material'
import ModuleHeader from 'src/components/module-header'
import { ExpenseHeaderProps } from '../../types'
import { downloadCsv } from '../helper'
// eslint-disable-next-line import/no-named-as-default
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import dayjs from 'dayjs'
import { useState } from 'react'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import PeriodSelector from 'src/pages/dashboard/components/PeriodSelector'
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers'

type RevenueRow = {
  revenueType: string
  amount: string
}

type ExpenseSummaryRow = {
  category: string
  amount: string
  percent: string
}

type ExpenseDetailRow = {
  subcategory: string
  lineItem: string
  amount: string
  rowType: 'subtotal' | 'line'
}

const ExpensePageHeader = ({
  avatarSrc,
  heading,
  dateRange,
  onDateChange,
  subheading,
  data,
  tooltipText,
  showDownloadBtn = true
}: ExpenseHeaderProps) => {
  const [loadingPDF, setLoadingPDF] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState('Last month')
  const [selectedMonth, setSelectedMonth] = useState(
    dayjs().subtract(1, 'month')
  )

  const applySelectedMonth = (monthDayjs: dayjs.Dayjs) => {
    if (!monthDayjs) return
    onDateChange({
      start: monthDayjs.startOf('month').toISOString(),
      end: monthDayjs.endOf('month').toISOString()
    })
  }

  const money = (value: any) => {
    const num = Number(value ?? 0)
    return `£${num.toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  }

  const toNum = (value: any) => Number(value ?? 0)

  const buildRevenueRows = (): RevenueRow[] => {
    return (data?.revenue_cateogories ?? []).map((item: any) => ({
      revenueType: item?.revenue_type ?? '-',
      amount: money(item?.amount ?? 0)
    }))
  }

  const buildExpenseSummaryRows = (): ExpenseSummaryRow[] => {
    return (data?.categories ?? []).map((item: any) => ({
      category: item?.parent_category ?? '-',
      amount: money(item?.amount ?? 0),
      percent:
        item?.share_of_total_percent !== undefined &&
        item?.share_of_total_percent !== null
          ? `${Number(item.share_of_total_percent).toFixed(2)}%`
          : '-'
    }))
  }

  const buildExpenseDetailRows = (
    expenseSubtypes: any[] = []
  ): ExpenseDetailRow[] => {
    const rows: ExpenseDetailRow[] = []

    expenseSubtypes.forEach((sub: any) => {
      const subName = sub?.expense_subtype ?? '-'
      const subTotal = money(sub?.total_amount ?? 0)
      const lineItems = Array.isArray(sub?.expense_sub_categories)
        ? sub.expense_sub_categories
        : []

      // Always show the subtype subtotal
      rows.push({
        subcategory: subName,
        lineItem: 'Subtotal',
        amount: subTotal,
        rowType: 'subtotal'
      })

      // Show every line item
      if (lineItems.length > 0) {
        lineItems.forEach((entry: any) => {
          const key = Object.keys(entry ?? {})[0]
          const value = key ? entry[key] : 0

          rows.push({
            subcategory: subName,
            lineItem: key ?? 'Line Item',
            amount: money(value ?? 0),
            rowType: 'line'
          })
        })
      } else {
        rows.push({
          subcategory: subName,
          lineItem: 'No line items',
          amount: subTotal,
          rowType: 'line'
        })
      }
    })

    return rows
  }

  const drawPageHeader = (pdf: jsPDF) => {
    const pageWidth = pdf.internal.pageSize.getWidth()

    pdf.setFillColor(0, 0, 0) // slate-900
    pdf.roundedRect(14, 12, pageWidth - 28, 24, 4, 4, 'F')

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(16)
    pdf.setTextColor(255, 255, 255)
    pdf.text('P&L Items Breakdown', 18, 22)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(subheading ?? '', 18, 29)

    const selectedDate =
      dateRange?.start && dateRange?.end
        ? `${dayjs(dateRange.start).format('DD MMM YYYY')} - ${dayjs(
            dateRange.end
          ).format('DD MMM YYYY')}`
        : '-'

    pdf.setFontSize(9)
    pdf.text(`Period: ${selectedDate}`, pageWidth - 18, 20, {
      align: 'right'
    })
    pdf.text(
      `Generated: ${dayjs().format('DD MMM YYYY, hh:mm A')}`,
      pageWidth - 18,
      27,
      {
        align: 'right'
      }
    )
  }

  const drawSummaryCards = (pdf: jsPDF) => {
    const totalRevenue = toNum(data?.total_revenue)
    const totalExpense = toNum(data?.total)
    const finalProfit = toNum(data?.final_profit)

    const cards = [
      {
        x: 14,
        title: 'Total Revenue',
        value: money(totalRevenue),
        fill: ['#d5e4d6'],
        border: ['#2e7d32'],
        text: ['#2e7d32']
      },
      {
        x: 74,
        title: 'Total Expenses',
        value: money(totalExpense),
        fill: ['#dcf2fd'],
        border: ['#0288d1'],
        text: ['#0288d1']
      },
      {
        x: 134,
        title: 'Operating profit',
        value: money(finalProfit),
        fill: finalProfit >= 0 ? ['#d5e4d6'] : ['#f8e0e0'],
        border: finalProfit >= 0 ? ['#2e7d32'] : ['#d32f2f'],
        text: finalProfit >= 0 ? ['#2e7d32'] : ['#d32f2f']
      }
    ]

    cards.forEach((card) => {
      pdf.setFillColor(card.fill[0], card.fill[1], card.fill[2])
      pdf.setDrawColor(card.border[0], card.border[1], card.border[2])
      pdf.roundedRect(card.x, 42, 56, 24, 4, 4, 'FD')

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(75, 85, 99)
      pdf.text(card.title, card.x + 4, 50)

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(14)
      pdf.setTextColor(card.text[0], card.text[1], card.text[2])
      pdf.text(card.value, card.x + 4, 59)
    })
  }

  const handleDownloadPDF = async () => {
    if (!data) return

    setLoadingPDF(true)
    // const prevExpanded = allExpanded

    try {
      // eslint-disable-next-line promise/param-names
      await new Promise((r) => setTimeout(r, 200))

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const left = 14
      const right = 14

      const addFooter = () => {
        const totalPages = pdf.getNumberOfPages()
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i)
          pdf.setDrawColor(226, 232, 240)
          pdf.line(14, 287, 196, 287)
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(8)
          pdf.setTextColor(100, 116, 139)
          pdf.text('P&L Breakdown Report', 14, 292)
          pdf.text(`Page ${i} of ${totalPages}`, 196, 292, { align: 'right' })
        }
      }

      const revenueRows = buildRevenueRows()
      const expenseSummaryRows = buildExpenseSummaryRows()

      // Cover/header
      drawPageHeader(pdf)
      drawSummaryCards(pdf)

      let y = 72

      // 1) Revenue section
      pdf.setFillColor(0, 0, 0) // emerald-500
      pdf.roundedRect(14, y, pageWidth - 28, 12, 3, 3, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.setTextColor(255, 255, 255)
      pdf.text('Revenue', 18, y + 8)
      y += 16

      autoTable(pdf, {
        startY: y,
        columns: [
          { header: 'Revenue Type', dataKey: 'revenueType' },
          { header: 'Amount', dataKey: 'amount' }
        ],
        body: revenueRows,
        theme: 'striped',
        margin: { left, right },
        styles: {
          font: 'helvetica',
          fontSize: 9,
          cellPadding: 2.5,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.1
        },
        headStyles: {
          fillColor: [0, 0, 0], // emerald-700
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250]
        }
      })

      y = (pdf as any).lastAutoTable.finalY + 12

      // 2) Expense summary section
      if (y > pageHeight - 40) {
        pdf.addPage()
        drawPageHeader(pdf)
        y = 72
      }

      pdf.setFillColor(0, 0, 0) // blue-600
      pdf.roundedRect(14, y, pageWidth - 28, 12, 3, 3, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.setTextColor(255, 255, 255)
      pdf.text('Expenses', 18, y + 8)
      y += 16

      autoTable(pdf, {
        startY: y,
        columns: [
          { header: 'Expense Category', dataKey: 'category' },
          { header: 'Amount', dataKey: 'amount' },
          { header: '% of Total', dataKey: 'percent' }
        ],
        body: expenseSummaryRows,
        theme: 'striped',
        margin: { left, right },
        styles: {
          font: 'helvetica',
          fontSize: 9,
          cellPadding: 2.5,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.1
        },
        headStyles: {
          fillColor: [0, 0, 0], // blue-800
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        }
      })

      y = (pdf as any).lastAutoTable.finalY + 12

      // 3) Expense category details
      ;(data?.categories ?? []).forEach((category: any) => {
        const expenseType = (data?.expense_type ?? []).find(
          (expense: any) => expense.expense_type === category?.parent_category
        )

        if (y > pageHeight - 52) {
          pdf.addPage()
          drawPageHeader(pdf)
          y = 72
        }

        const subtypes = expenseType?.expense_subtypes ?? []
        const detailRows = buildExpenseDetailRows(subtypes)

        pdf.setFillColor(248, 250, 252)
        pdf.setDrawColor(226, 232, 240)
        pdf.roundedRect(14, y, pageWidth - 28, 14, 3, 3, 'FD')

        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(12)
        pdf.setTextColor(0, 0, 0)
        pdf.text(category?.parent_category ?? 'Expense Category', 18, y + 9)

        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9)
        pdf.setTextColor(71, 85, 105)
        pdf.text(
          `${money(category?.amount ?? 0)} • ${category?.share_of_total_percent ?? '0.00'}%`,
          pageWidth - 18,
          y + 9,
          { align: 'right' }
        )

        y += 18

        autoTable(pdf, {
          startY: y,
          columns: [
            { header: 'Subcategory', dataKey: 'subcategory' },
            { header: 'Line Item', dataKey: 'lineItem' },
            { header: 'Amount', dataKey: 'amount' }
          ],
          body: detailRows,
          theme: 'grid',
          margin: { left, right },
          styles: {
            font: 'helvetica',
            fontSize: 8.8,
            cellPadding: 2.5,
            textColor: [30, 41, 59], // default for body
            lineColor: [226, 232, 240],
            lineWidth: 0.1
          },
          headStyles: {
            fillColor: [0, 0, 0], // slate-900
            textColor: [255, 255, 255], // White - must be array
            fontStyle: 'bold',
            halign: 'left',
            valign: 'middle',
            lineColor: [226, 232, 240],
            lineWidth: 0.1
          },
          // Force white text on header using hook (most reliable method)
          didParseCell: (hookData) => {
            const row = hookData.row.raw as ExpenseDetailRow | undefined

            if (hookData.section === 'head') {
              hookData.cell.styles.textColor = [255, 255, 255]
              hookData.cell.styles.fillColor = [0, 0, 0]
              hookData.cell.styles.fontStyle = 'bold'
            } else if (row && row.rowType === 'subtotal') {
              hookData.cell.styles.fontStyle = 'bold'
              hookData.cell.styles.fillColor = [241, 245, 249]
              hookData.cell.styles.textColor = [0, 0, 0]
            } else {
              hookData.cell.styles.textColor = [71, 85, 105]
              if (hookData.column.dataKey === 'lineItem') {
                hookData.cell.styles.cellPadding = {
                  top: 2.5,
                  right: 2.5,
                  bottom: 2.5,
                  left: 6
                }
              }
            }
          }
        })

        y = (pdf as any).lastAutoTable.finalY + 10
      })

      addFooter()

      pdf.save(`P&L Breakdown-${dayjs().format('DD-MM-YYYY')}.pdf`)
    } finally {
      setLoadingPDF(false)
    }
  }

  const handlePdfClick = () => {
    setLoadingPDF(true)
    setTimeout(() => {
      handleDownloadPDF()
    }, 300)
  }

  return (
    <>
      <Box
        sx={{
          pt: 2,
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
          tooltipText={tooltipText}
        />

        {showDownloadBtn && (
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
                mb: 0,
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'start', sm: 'center' },
                gap: 1
              }}
            >
              <Box>
                {selectedPeriod === 'Last month' && (
                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DatePicker
                      views={['year', 'month']}
                      label='Select Month'
                      value={selectedMonth}
                      onChange={(newValue: any) => {
                        setSelectedMonth(newValue)
                        setSelectedPeriod('Last month')
                        applySelectedMonth(newValue)
                      }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          sx: {
                            '& .MuiPickersInputBase-root': {
                              borderRadius: '12px'
                            },
                            size: 'small',
                            '& input': { padding: '8px 0px 8px 12px' }
                          }
                        }
                      }}
                    />
                  </LocalizationProvider>
                )}
              </Box>

              <PeriodSelector
                options={['Last month', '3-month view', 'Yearly']}
                selected={selectedPeriod}
                onSelect={(period) => {
                  setSelectedPeriod(period)

                  if (period === 'Last month') {
                    const lastMonth = dayjs().subtract(1, 'month')
                    setSelectedMonth(lastMonth)
                    applySelectedMonth(lastMonth)
                  } else if (period === '3-month view') {
                    const start = dayjs().subtract(2, 'month').startOf('month')
                    const end = dayjs().endOf('month')
                    onDateChange({
                      start: start.toISOString(),
                      end: end.toISOString()
                    })
                  } else if (period === 'Yearly') {
                    const start = dayjs().startOf('year')
                    const end = dayjs().endOf('year')
                    onDateChange({
                      start: start.toISOString(),
                      end: end.toISOString()
                    })
                  }
                }}
              />
            </Box>
          </Box>
        )}
      </Box>

      {showDownloadBtn && (
        <Box display='flex' gap={1.5} justifyContent='flex-end' width='100%'>
          <Button
            variant='contained'
            onClick={() => downloadCsv(data)}
            disabled={!data}
            sx={{ height: 40, alignSelf: 'center', whiteSpace: 'nowrap' }}
          >
            Download CSV
          </Button>

          <Button
            variant='outlined'
            onClick={handlePdfClick}
            disabled={!data || loadingPDF}
            sx={{ height: 40, alignSelf: 'center', whiteSpace: 'nowrap' }}
          >
            {loadingPDF ? 'Generating PDF...' : 'Download PDF'}
          </Button>
        </Box>
      )}
    </>
  )
}

export default ExpensePageHeader
