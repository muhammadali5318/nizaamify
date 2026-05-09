import { describe, expect, it } from 'vitest'
import { formatPKR } from './env'

describe('formatPKR', () => {
  it('formats whole rupee values', () => {
    const out = formatPKR(1500)
    expect(out).toContain('1,500')
  })

  it('returns the input when value is not numeric', () => {
    const out = formatPKR('not a number')
    expect(out).toBe('not a number')
  })

  it('formats numeric strings', () => {
    const out = formatPKR('2500')
    expect(out).toContain('2,500')
  })
})
