import apiClient from '../api-client'

export interface NonPLCategory {
  parent_category: string
  amount: string
}

export interface NonPLExpenseSubtype {
  expense_subtype: string
  expense_sub_categories: Record<string, string>[]
  total_amount: string
}

export interface NonPLExpenseType {
  expense_type: string
  amount: string
  expense_subtypes: NonPLExpenseSubtype[]
}

export interface NonPLBreakdownResponse {
  label: string
  total: string
  categories: NonPLCategory[]
  expense_type: NonPLExpenseType[]
}

export const fetchNonPLExpenseBreakdown = async (
  practiceId: string,
  startDate: string,
  endDate: string
): Promise<NonPLBreakdownResponse> => {
  const { data } = await apiClient.get(
    `/docs/v1/practices/${practiceId}/non-pl-expense-breakdown/`,
    {
      params: {
        start_date: startDate,
        end_date: endDate
      }
    }
  )

  return data.data
}
