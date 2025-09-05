import { ReactNode } from 'react'
import useRedirectLoggedInToHome from 'src/hooks/useRedirectLoggedInToHome'

type Props = { children: ReactNode }

const RedirectAuthGuard = ({ children }: Props): ReactNode => {
  useRedirectLoggedInToHome()
  return <>{children}</>
}

export default RedirectAuthGuard
