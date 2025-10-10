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
