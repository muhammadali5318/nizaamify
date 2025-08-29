import { render, screen } from '@testing-library/react'
import Dummy from './Dummy'
import { expect, test } from 'vitest'

test('renders default hello message', () => {
  render(<Dummy />)
  expect(screen.getByText(/hello, world!/i)).toBeInTheDocument()
})

test('renders hello with custom name', () => {
  render(<Dummy name='Ali' />)
  expect(screen.getByText(/hello, ali!/i)).toBeInTheDocument()
})
