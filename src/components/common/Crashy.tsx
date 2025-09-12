import { JSX } from 'react'

export default function Crashy(): JSX.Element {
  // intentional render-time error to exercise ErrorBoundary
  throw new Error('💥 test crash from Crashy')
}
