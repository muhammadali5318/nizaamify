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
