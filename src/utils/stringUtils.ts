// src/utils/stringUtils.ts
export const capitalizeFirstLetter = (text: string): string => {
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

export const toTitleCase = (text: string): string => {
  if (!text) return ''

  return text
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export const formatTitle = (text: string): string => {
  if (!text) return ''

  // Special edge cases
  const specialCases: Record<string, string> = {
    'ai assistant': 'AI Assistant'
  }

  const lower = text.toLowerCase()

  // Return special case if exists
  if (specialCases[lower]) return specialCases[lower]

  // Split words, lowercase all except first word
  const words = lower.split(' ').filter(Boolean)

  if (words.length === 0) return ''

  // Capitalize first word, rest lowercase
  return [
    words[0][0].toUpperCase() + words[0].slice(1),
    ...words.slice(1)
  ].join(' ')
}

export const getTextAfterDelimiter = (text: string): string => {
  if (!text) return ''

  const parts = text.split('-')
  return parts[1]?.trim() || ''
}

export const formatAmountWithCommas = (amount: number | string): string => {
  if (amount === null || amount === undefined || amount === '') {
    return '0'
  }

  const num = typeof amount === 'string' ? Number(amount) : amount

  if (isNaN(num)) return '0'

  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

export const formatChatDate = (isoDate?: string) => {
  if (!isoDate) return ''

  const date = new Date(isoDate)
  const now = new Date()

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  if (isToday) {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffWeeks = Math.floor(diffDays / 7)

  // Yesterday
  if (diffDays <= 1) {
    return '1 day ago'
  }

  // Days ago (2–6 days)
  if (diffDays < 7) {
    return `${diffDays} days ago`
  }

  // Weeks ago
  if (diffWeeks === 1) {
    return '1 week ago'
  }

  return `${diffWeeks} weeks ago`
}
