import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material'

import ExpensesGrandTotal from './components/expense-header'
import ReusableAccordion from './components/expense-accordion'

import { formatAmountWithCommas } from 'src/utils/stringUtils'

// eslint-disable-next-line import/no-named-as-default
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import RevenueAccordion from './components/revenue-accordion'
import NonPLItemsBreakdown from '../non-pl-items'
import { useSelector } from 'react-redux'
import {
  selectExpenseBreakdownDateRange,
  setDateRange
} from 'src/store/slices/expenseBreakdownSlice'
import { useFetchExpenseBreakdown } from './hooks/useFetchExpenseBreakdown'
import { useAuth } from 'src/context/AuthProvider'
import { useState } from 'react'
import { downloadCsv } from './components/helper'
import dayjs from 'dayjs'

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

const ProfitLossTab = () => {
  const [loadingPDF, setLoadingPDF] = useState(false)

  const dateRange = useSelector(selectExpenseBreakdownDateRange)

  const hasValidDate = Boolean(dateRange?.start) && Boolean(dateRange?.end)
  const { accessToken } = useAuth()

  const { data, isPending } = useFetchExpenseBreakdown({
    enabled: !!accessToken && hasValidDate,
    startDate: dateRange.start,
    endDate: dateRange.end
  })

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
    pdf.text('Detailed view of P&L items categories and subcategories', 18, 29)

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

  const drawSummaryCards = (pdf: jsPDF) => {
    const totalRevenue = toNum(data?.total_revenue)
    const totalExpense = toNum(data?.total)
    const finalProfit = toNum(data?.final_profit)

    const cards = [
      {
        x: 14,
        title: 'Total Revenue',
        value: money(totalRevenue),
        fill: ['#fff0d9'],
        border: ['#EF6C00'],
        text: ['#EF6C00']
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
      {!hasValidDate && (
        <Box
          minHeight='20vh'
          width='100%'
          display='flex'
          alignItems='center'
          justifyContent='center'
          textAlign='center'
        >
          <Typography variant='body2' color='text.secondary'>
            Select a date range to view expense breakdown.
          </Typography>
        </Box>
      )}

      {hasValidDate && isPending && (
        <Box
          width='100%'
          display='flex'
          alignItems='center'
          justifyContent='center'
          minHeight='20vh'
        >
          <CircularProgress />
        </Box>
      )}
      {hasValidDate && !isPending && data && (
        <Stack spacing={2} width='100%'>
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
          <Stack
            spacing={2}
            sx={{
              borderRadius: '24px',
              border: '1px solid var(--grey-200)',
              padding: 2
            }}
          >
            <ExpensesGrandTotal
              title='REVENUE GRAND TOTAL'
              label='Total Monthly Revenue:'
              total={formatAmountWithCommas(data?.total_revenue) ?? 0}
            />
            <RevenueAccordion
              title='Income/Revenue'
              dateRange={dateRange}
              incomeAndRevenue={data?.revenue_cateogories}
              total={data?.total_revenue}
            />
          </Stack>

          <Stack
            spacing={2}
            sx={{
              borderRadius: '24px',
              border: '1px solid var(--grey-200)',
              padding: 2
            }}
          >
            <ExpensesGrandTotal
              title='EXPENSES GRAND TOTAL'
              label='Total Monthly Expenses:'
              total={formatAmountWithCommas(data?.total) ?? 0}
            />
            {data?.categories?.map((category: any, idx: number) => {
              const expenseType = data?.expense_type?.find(
                (expense: any) =>
                  expense.expense_type === category?.parent_category
              )

              return (
                <ReusableAccordion
                  key={idx}
                  title={category?.parent_category}
                  dateRange={dateRange}
                  total={category?.amount}
                  chips={[
                    `${expenseType?.expense_subtypes?.length ?? 0} subcategories`
                  ]}
                  expenseSubtypes={expenseType?.expense_subtypes}
                  totalPercentage={category?.share_of_total_percent}
                />
              )
            })}
          </Stack>
        </Stack>
      )}

      <Box my={2}>
        <ExpensesGrandTotal
          title='OPERATING PROFIT TOTAL'
          label='Total Monthly Operating profit:'
          total={formatAmountWithCommas(data?.final_profit) ?? 0}
        />
      </Box>
      <NonPLItemsBreakdown dateRange={dateRange} onDateChange={setDateRange} />
    </>
  )
}

export default ProfitLossTab
