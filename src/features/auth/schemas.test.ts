import { describe, expect, it } from 'vitest'
import { loginSchema, signupSchema } from './schemas'

const t = ((key: string) => key) as unknown as Parameters<typeof loginSchema>[0]

describe('login schema', () => {
  it('accepts a valid email + 8-char password', () => {
    const r = loginSchema(t).safeParse({
      email: 'a@b.com',
      password: 'password1'
    })
    expect(r.success).toBe(true)
  })

  it('rejects a short password', () => {
    const r = loginSchema(t).safeParse({
      email: 'a@b.com',
      password: 'short'
    })
    expect(r.success).toBe(false)
  })

  it('rejects an invalid email', () => {
    const r = loginSchema(t).safeParse({
      email: 'not-an-email',
      password: 'password1'
    })
    expect(r.success).toBe(false)
  })
})

describe('signup schema', () => {
  it('rejects mismatched confirm password', () => {
    const r = signupSchema(t).safeParse({
      email: 'a@b.com',
      password: 'password1',
      confirmPassword: 'password2'
    })
    expect(r.success).toBe(false)
  })

  it('accepts matching passwords', () => {
    const r = signupSchema(t).safeParse({
      email: 'a@b.com',
      password: 'password1',
      confirmPassword: 'password1'
    })
    expect(r.success).toBe(true)
  })
})
