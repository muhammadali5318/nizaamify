export const getModifiedDocuments = (batches: any) => {
  const modifiedDocs: any[] = []

  Object.values(batches).forEach((batch: any) => {
    const originals = batch.originalDocuments || []
    batch.documents.forEach((doc: any) => {
      const original = originals.find(
        (o: any) => o.document_id === doc.document_id
      )
      if (!original) return

      const changes: any = {}
      Object.keys(doc).forEach((key) => {
        if (doc[key] !== original[key]) {
          changes[key] = doc[key]
        }
      })

      if (Object.keys(changes).length > 0) {
        modifiedDocs.push({
          document_id: doc.document_id,
          ...changes
        })
      }
    })
  })

  return modifiedDocs
}
