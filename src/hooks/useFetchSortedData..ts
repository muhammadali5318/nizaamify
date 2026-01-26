import { GridSortModel } from '@mui/x-data-grid'
import { useState, useCallback } from 'react'

export const useFetchSortedPaginatedData = (
  initialPage = 0,
  initialPageSize = 10
) => {
  const [sortModel, setSortModel] = useState<GridSortModel>([])
  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(initialPageSize)

  const handleSortChange = useCallback(
    (model: GridSortModel) => {
      const nextField = model?.[0]?.field ?? undefined
      const nextSort = model?.[0]?.sort ?? undefined

      const currField = sortModel?.[0]?.field
      const currSort = sortModel?.[0]?.sort

      if (nextField === currField && nextSort === currSort) return

      setSortModel(model)
      setPage(0)
    },
    [sortModel]
  )

  return {
    sortModel,
    page,
    pageSize,
    setPage,
    setPageSize,
    handleSortChange,
    ordering: sortModel?.[0]?.field,
    sortOrder: sortModel?.[0]?.sort
  }
}
