import apiClient from '../api-client'

export const getExpenseData = async (
  activePracticeId: string,
  granularity: string,
  year: number,
  month: number | null
) => {
  try {
    const params = new URLSearchParams({
      granularity,
      year: year.toString()
    })

    if (month) params.append('month', month.toString())

    const response = await apiClient.get(
      `/docs/v1/practices/${activePracticeId}/dashboard/expense-breakdown/?${params.toString()}`
    )

    return response.data.data
  } catch (error) {
    console.error('Error fetching expense data:', error)
    throw error
  }
}
