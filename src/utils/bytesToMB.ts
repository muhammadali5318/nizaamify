// utils/bytesToReadableSize.ts
export function bytesToReadableSize(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 KB'

  const KB = bytes / 1024
  const MB = bytes / (1024 * 1024)

  if (MB < 1) {
    return `${KB.toFixed(decimals)} KB`
  }

  return `${MB.toFixed(decimals)} MB`
}
