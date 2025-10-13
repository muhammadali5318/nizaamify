// src/utils/arrayUtils.ts
export const convertArrayToUpperCase = (arr: string[]): string[] => {
  if (!Array.isArray(arr)) return []
  return arr.map((item) => item.toUpperCase())
}
