import apiClient from '../api-client'

export const getInvoices = async (params: {
  practiceId: string
  page?: number
  pageSize?: number
  search?: string
  period_start?: string
  period_end?: string
  [key: string]: any
}) => {
  const { practiceId, page, pageSize, ...rest } = params

  const res = await apiClient.get(
    `/subscription/v1/practices/${practiceId}/invoices/`,
    {
      params: {
        page,
        page_size: pageSize,
        ...rest
      }
    }
  )

  return res.data
}
