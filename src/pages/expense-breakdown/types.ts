import { RangeISO } from 'src/components/date-range-selector'

export type ExpenseSubCategory = {
  expense_sub_category?: string
  total_amount?: string
}

export type ExpenseSubtype = {
  expense_subtype: string
  expense_sub_categories: ExpenseSubCategory[]
  total_amount: string
}

export type ExpenseType = {
  expense_type: string
  amount: string
  expense_subtypes: ExpenseSubtype[]
}

export type Category = {
  parent_category: string
  amount: string
}

export type DataShape = {
  label?: string
  total?: string
  categories?: Category[]
  expense_type?: ExpenseType[]
}

export type ExpenseHeaderProps = {
  dateRange: RangeISO
  onDateChange: (range: RangeISO) => void
  heading?: string | any
  avatarSrc?: string | any
  subheading?: string | any
  data?: DataShape
  allExpanded: boolean
  setAllExpanded: (val: boolean) => void
  pdfRef?: React.RefObject<HTMLDivElement | null>
  showDownloadBtn?: boolean
  tooltipText?: string
}
