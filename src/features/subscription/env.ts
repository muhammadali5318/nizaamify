export const subscriptionEnv = {
  monthlyPrice: import.meta.env.VITE_MONTHLY_PRICE_PKR ?? '',
  bankName: import.meta.env.VITE_BANK_NAME ?? '',
  bankAccountName: import.meta.env.VITE_BANK_ACCOUNT_NAME ?? '',
  bankAccountNumber: import.meta.env.VITE_BANK_ACCOUNT_NUMBER ?? '',
  supportPhone: import.meta.env.VITE_SUPPORT_PHONE ?? '',
  supportWhatsapp: import.meta.env.VITE_SUPPORT_WHATSAPP ?? '',
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL ?? ''
}

export function whatsappLink(message: string): string {
  const num = subscriptionEnv.supportWhatsapp.replace(/[^\d+]/g, '')
  if (!num) return '#'
  return `https://wa.me/${num.replace(/^\+/, '')}?text=${encodeURIComponent(message)}`
}

export function formatPKR(value: number | string, locale = 'en-PK'): string {
  const n = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(n)) return String(value)
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0
  }).format(n)
}
