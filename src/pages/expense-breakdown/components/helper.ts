import { DataShape } from '../types'

const escapeCsv = (value: unknown) => {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // Escape double quotes by doubling them and wrap value in quotes if it contains comma, quote or newline
  if (/[,"\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

const buildCsvRows = (data: DataShape) => {
  const rows: Array<Array<string>> = []

  // Friendly, flat report headers (expenses)
  rows.push([
    'Date range',
    'Category',
    'Category total',
    'Expense subtype',
    'Subtype amount'
  ])

  const categoryMap = new Map(
    (data.categories || []).map((c) => [c.parent_category, c.amount])
  )

  ;(data.expense_type || []).forEach((etype) => {
    const categoryTotal =
      categoryMap.get(etype.expense_type) ?? etype.amount ?? ''

    // Category summary row
    rows.push([data.label ?? '', etype.expense_type, categoryTotal, '', ''])

    // Subtype rows
    etype.expense_subtypes.forEach((subtype) => {
      rows.push([
        data.label ?? '',
        etype.expense_type,
        '',
        subtype.expense_subtype,
        subtype.total_amount ?? ''
      ])
    })
  })

  // Grand total row for expenses
  rows.push([data.label ?? '', 'TOTAL', data.total ?? '', '', ''])

  // --------- Revenue section (appended after expense table) ----------
  const revenueList =
    // support typo or correctly spelled key
    (data as any).revenue_cateogories || (data as any).revenue_categories || []

  if (Array.isArray(revenueList) && revenueList.length > 0) {
    // blank separation row
    rows.push(['', '', '', '', ''])

    // Revenue-specific header (mapped into same 5-column layout)
    // Columns: Date range | Revenue type | Category total | Source | Amount
    rows.push([
      'Date range',
      'Revenue type',
      'Category total',
      'Source',
      'Amount'
    ])

    revenueList.forEach((r: any) => {
      rows.push([
        data.label ?? '',
        r.revenue_type ?? '',
        '', // no category total for revenue rows
        r.source ?? '',
        r.amount ?? ''
      ])
    })

    // Grand total row for revenue — put total where earlier 'Category total' sits for consistency
    rows.push([
      data.label ?? '',
      'TOTAL REVENUE',
      (data as any).total_revenue ?? '',
      '',
      ''
    ])
  }

  return rows
}

const generateCsvString = (rows: Array<Array<string>>) => {
  return rows.map((r) => r.map(escapeCsv).join(',')).join('\n')
}

export const downloadCsv = (data?: DataShape) => {
  if (!data) return
  const rows = buildCsvRows(data)
  const csvString = generateCsvString(rows)
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
  const label = data.label
    ? data.label.replace(/[^a-z0-9-_]/gi, '_')
    : new Date().toISOString().slice(0, 10)
  const filename = `expenses_revenue_${label}.csv`

  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
