import { describe, expect, it } from 'vitest'
import { shopStepSchema, ownerStepSchema } from './schemas'

const t = ((key: string) => key) as unknown as Parameters<
  typeof shopStepSchema
>[0]

describe('onboarding shop step schema', () => {
  it('accepts a valid shop', () => {
    const r = shopStepSchema(t).safeParse({
      shop_name: 'Test Shop',
      shop_address: '123 Mall Rd',
      shop_phone: '+923001234567',
      shop_type: ''
    })
    expect(r.success).toBe(true)
  })

  it('rejects a non-PK phone', () => {
    const r = shopStepSchema(t).safeParse({
      shop_name: 'Test',
      shop_address: '123 Mall Rd',
      shop_phone: '+1234567890123',
      shop_type: ''
    })
    expect(r.success).toBe(false)
  })

  it('accepts the 0-prefix phone variant', () => {
    const r = shopStepSchema(t).safeParse({
      shop_name: 'Test',
      shop_address: '123 Mall Rd',
      shop_phone: '03001234567',
      shop_type: ''
    })
    expect(r.success).toBe(true)
  })

  it('rejects too-short shop name', () => {
    const r = shopStepSchema(t).safeParse({
      shop_name: 'X',
      shop_address: '123 Mall Rd',
      shop_phone: '+923001234567'
    })
    expect(r.success).toBe(false)
  })
})

describe('onboarding owner step schema', () => {
  it('rejects bad CNIC format', () => {
    const r = ownerStepSchema(t).safeParse({
      owner_name: 'Test Owner',
      owner_phone: '+923001234567',
      owner_cnic: '1234-5678-9',
      owner_address: '123 Mall Rd'
    })
    expect(r.success).toBe(false)
  })

  it('accepts well-formed CNIC', () => {
    const r = ownerStepSchema(t).safeParse({
      owner_name: 'Test Owner',
      owner_phone: '+923001234567',
      owner_cnic: '12345-1234567-1',
      owner_address: '123 Mall Rd'
    })
    expect(r.success).toBe(true)
  })

  it('treats empty CNIC as valid (optional)', () => {
    const r = ownerStepSchema(t).safeParse({
      owner_name: 'Test Owner',
      owner_phone: '+923001234567',
      owner_cnic: '',
      owner_address: '123 Mall Rd'
    })
    expect(r.success).toBe(true)
  })
})
