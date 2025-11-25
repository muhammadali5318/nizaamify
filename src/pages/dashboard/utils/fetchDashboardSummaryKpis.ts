import apiClient from 'src/services/api-client'

interface DashboardKpiResponse {
  status: boolean
  message: string
  data: {
    period: number
    revenue: string
    costs: string
    operating_profit: string
    operating_profit_margin: string
    ebidta: string
    practice_value: string
    revenue_change_percent: string
    costs_change_percent: string
    current_period: {
      start_month: string
      end_month: string
    }
    previous_period: {
      start_month: string
      end_month: string
    }
    warnings: string | null
  }
  error: Record<string, any>
}

/**
 * Fetches Dashboard KPIs using date range filters instead of period.
 *
 * @param user - Auth0 user
 * @param token - access token
 * @param start_date - start date in YYYY-MM-DD format
 * @param end_date - end date in YYYY-MM-DD format
 */
export const fetchDashboardSummaryKpis = async (
  practiceId: string,
  start_date: string,
  end_date: string
): Promise<DashboardKpiResponse['data']> => {
  try {
    if (!practiceId) throw new Error('Practice ID not found.')

    const response = await apiClient.get<DashboardKpiResponse>(
      `/docs/v1/practices/${practiceId}/dashboard/summary-kpis`,
      {
        params: { start_date, end_date }
      }
    )

    if (response.data?.status) {
      return response.data.data
    } else {
      throw new Error(response.data?.message || 'Failed to fetch KPIs')
    }
  } catch (error) {
    console.error('Error fetching dashboard KPIs:', error)
    throw error
  }
}
