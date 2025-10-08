export const ROLE_OPTIONS = ['Admin', 'Manager'] as const
export const STATUS_OPTIONS = ['Active', 'Pending', 'Inactive'] as const

export const ITEM_HEIGHT = 48
export const ITEM_PADDING_TOP = 8

export const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 260
    }
  }
}

export type MemberRow = {
  id: string
  name: string
  email: string
  role: string
  status: string
}

/**
 * Generate dummy rows. Pure util so it can be used in tests or elsewhere.
 */
export const generateDummyData = (count = 50): MemberRow[] => {
  const names = [
    'Ali Khan',
    'Sara Ahmed',
    'Hassan Raza',
    'Ayesha Noor',
    'Bilal Malik',
    'Fatima Iqbal',
    'Usman Tariq',
    'Zara Ali',
    'Omar Siddiqui',
    'Maryam Khan'
  ]

  return Array.from({ length: count }).map((_, i) => {
    const base = names[i % names.length]
    const name = `${base} ${i + 1}`
    return {
      id: `m-${i + 1}`,
      name,
      email: `${base.toLowerCase().replace(/\s+/g, '.')}.${i}@example.com`,
      role: ROLE_OPTIONS[i % ROLE_OPTIONS.length],
      status: STATUS_OPTIONS[i % STATUS_OPTIONS.length]
    }
  })
}

/**
 * Simple helper to get effective page index safe against out-of-range values.
 */
export const clampPage = (page: number, pageCount: number) =>
  Math.min(page, Math.max(0, Math.max(0, pageCount - 1)))
