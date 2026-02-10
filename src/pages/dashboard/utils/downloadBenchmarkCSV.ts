type DownloadBenchmarkCsvOptions = {
  filename?: string
}

export const downloadBenchmarkCsv = (
  data: any,
  getUKAvgValue: (label: string, practiceType: string) => string | number,
  activePracticeType: string,
  options: DownloadBenchmarkCsvOptions = {}
) => {
  const { filename = 'benchmark.csv' } = options

  const expenseTypes = data?.current?.expense_types || []

  /* -------------------------
     CSV helpers
     ------------------------- */
  const escapeCsv = (value: any) => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
  }

  const rows: string[][] = []

  /* -------------------------
     CSV header (UX friendly)
     ------------------------- */
  rows.push([
    'Row Type', // CATEGORY | SUBCATEGORY
    'Category',
    'Subcategory',
    'Your practice value (£)',
    '% of total',
    'UK Avg (NHS)',
    'Monai benchmarking'
  ])

  /* -------------------------
     Build rows
     ------------------------- */
  expenseTypes.forEach((type: any) => {
    if (type.expense_type === 'Tax Documents') return

    // -------- Parent row --------
    rows.push([
      'CATEGORY',
      type.expense_type,
      '',
      Number(type.amount || 0).toFixed(2),
      Number(type.share_of_total_percent || 0).toFixed(2),
      getUKAvgValue(type.expense_type, activePracticeType) ?? '',
      '-'
    ])

    // -------- Child rows --------
    const subtypes = Array.isArray(type.expense_subtypes)
      ? type.expense_subtypes
      : []
    subtypes?.forEach((sub: any) => {
      rows.push([
        'SUBCATEGORY',
        type.expense_type,
        sub.expense_subtype,
        Number(sub.amount || 0).toFixed(2),
        '',
        getUKAvgValue(sub.expense_subtype, activePracticeType) ?? '',
        '-'
      ])
    })
  })

  /* -------------------------
     Convert to CSV
     ------------------------- */
  const csvContent = rows
    .map((row) => row.map(escapeCsv).join(','))
    .join('\r\n')

  /* -------------------------
     Trigger download
     ------------------------- */
  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;'
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()

  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
