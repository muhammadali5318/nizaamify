import apiClient from 'src/services/api-client'

export const getOperatingProfitTrend = async ({
  practiceId,
  granularity = 'month',
  year,
  month
}: {
  practiceId: string
  granularity?: string
  year?: number
  month?: number
}) => {
  const res = await apiClient.get(
    `/docs/v1/practices/${practiceId}/dashboard/operating-profit-trend/`,
    {
      params: { granularity, year, month }
    }
  )

  return res.data?.data
}
