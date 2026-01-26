import { useEffect, useState } from 'react'
import {
  fetchNonPLExpenseBreakdown,
  NonPLBreakdownResponse
} from 'src/services/apis/nonPLExpenseBreakdown'

interface Props {
  practiceId: string
  startDate: string
  endDate: string
}

export const useFetchNonPLBreakdown = ({
  practiceId,
  startDate,
  endDate
}: Props) => {
  const [data, setData] = useState<NonPLBreakdownResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    if (!practiceId) return

    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await fetchNonPLExpenseBreakdown(
          practiceId,
          startDate,
          endDate
        )
        setData(response)
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [practiceId, startDate, endDate])

  return { data, loading, error }
}
