export function getFileNameFromUrl(url: string): string | null {
  if (!url) return null
  try {
    const parts = url.split('/')
    const last = parts.pop() || ''
    return last.split('?')[0] || null
  } catch {
    return null
  }
}

export async function fetchAndSaveFile(
  fileUrl: string,
  suggestedName?: string
) {
  if (!fileUrl) throw new Error('No file URL provided')

  const response = await fetch(fileUrl)
  if (!response.ok) throw new Error('Failed to fetch file')

  const blob = await response.blob()
  const link = document.createElement('a')
  const name = suggestedName || getFileNameFromUrl(fileUrl) || 'downloaded-file'
  link.href = URL.createObjectURL(blob)
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(link.href)
}
