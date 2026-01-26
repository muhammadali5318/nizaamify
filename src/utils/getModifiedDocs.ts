const EDITABLE_FIELDS = [
  'document_category',
  'document_type',
  'document_subtype',
  'expense_category',
  'amount',
  'document_date',
  'payment_date'
]

const normalizeDate = (val: any) => {
  if (!val) return ''
  // Extract YYYY-MM-DD from ISO or simple date strings
  const match = String(val).match(/^\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : String(val).trim()
}

const normalizeAmount = (val: any) => {
  const parsed = parseFloat(String(val))
  return isNaN(parsed) ? '' : parsed.toFixed(2)
}

export const getModifiedDocuments = (batches: any) => {
  const allDocs: any[] = []

  Object.values(batches).forEach((batch: any) => {
    batch.documents.forEach((doc: any) => {
      const originals = batch.originalDocuments || []
      const original = originals.find(
        (o: any) => o.document_id === doc.document_id
      )

      const payloadDoc: any = { document_id: doc.document_id }

      if (original) {
        EDITABLE_FIELDS.forEach((field) => {
          const val1 = doc[field]
          const val2 = original[field]

          let isSame = false
          if (field === 'amount') {
            isSame = normalizeAmount(val1) === normalizeAmount(val2)
          } else if (field === 'document_date' || field === 'payment_date') {
            isSame = normalizeDate(val1) === normalizeDate(val2)
          } else {
            // Standard string comparison
            const s1 = (val1 ?? '').toString().trim()
            const s2 = (val2 ?? '').toString().trim()
            isSame = s1 === s2
          }

          if (!isSame) {
            payloadDoc[field] = doc[field]
          }
        })
      }

      allDocs.push(payloadDoc)
    })
  })

  return allDocs
}
