import { useSelector } from 'react-redux'
import {
  selectUserDetailsInActivePractice,
  selectPermissionsInActivePractice
} from 'src/store/slices/userDetailsInActivePracticeSlice'

export function useUserDetailsInActivePractice() {
  const userDetails = useSelector(selectUserDetailsInActivePractice)
  const permissions = useSelector(selectPermissionsInActivePractice)

  return {
    userDetails,
    permissions
  }
}
