// src/hooks/useActivePractice.ts
import { useDispatch, useSelector } from 'react-redux'
import {
  selectActivePractice,
  selectActivePracticeId,
  setActivePractice as setActivePracticeAction,
  setActivePracticeById as setActivePracticeByIdAction,
  AllPracticesDataObject
} from 'src/store/slices/activePracticeSlice'
import { queryClient } from 'src/utils/queryClient'
import { removeAllQueriesExceptExact } from 'src/utils/queryHelpers'

export function useActivePractice() {
  const dispatch = useDispatch()

  const activePractice = useSelector(selectActivePractice)
  const activePracticeId = useSelector(selectActivePracticeId)

  const setActivePractice = (practice: AllPracticesDataObject | null) => {
    dispatch(setActivePracticeAction(practice))
    removeAllQueriesExceptExact([['listAllPracticesData']])
  }

  const setActiveById = (
    id: string,
    allPractices: AllPracticesDataObject[]
  ) => {
    dispatch(setActivePracticeByIdAction({ id, allPractices }))
    queryClient.removeQueries()
    queryClient.clear()
  }

  const isOnboardingCompleted =
    activePractice?.onboarding_status === 'COMPLETED'

  return {
    activePractice,
    activePracticeId,
    setActivePractice,
    setActiveById,
    isOnboardingCompleted
  }
}
