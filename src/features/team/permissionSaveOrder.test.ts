import { describe, expect, it } from 'vitest'
import { sortPermissionsForSave } from './permissionSaveOrder'
import type { CatalogRow } from './hooks'

const row = (
  key: string,
  requires: string[] = [],
  display_order = 0
): CatalogRow => ({
  key,
  name: key,
  description: '',
  category: 'products',
  preset_owner_default: true,
  preset_manager_default: false,
  preset_salesperson_default: false,
  requires,
  display_order,
  is_active: true
})

// Mirrors the live catalog for the perms exercised in the bug:
//   - view_products has no prereqs
//   - view_product_cost requires view_products
//   - record_purchase requires view_products, view_product_cost, view_purchases,
//     view_suppliers, view_inventory_batches
const catalog: CatalogRow[] = [
  row('view_products', [], 5),
  row('view_product_cost', ['view_products'], 11),
  row('view_purchases', [], 20),
  row('view_suppliers', [], 21),
  row('view_inventory_batches', [], 22),
  row(
    'record_purchase',
    [
      'view_products',
      'view_product_cost',
      'view_purchases',
      'view_suppliers',
      'view_inventory_batches'
    ],
    23
  )
]

describe('sortPermissionsForSave', () => {
  it('revokes the dependent before its dependency', () => {
    // The exact failing case from self-pilot Step 7. dirtyKeys arrives in
    // catalog display_order: parent (view_product_cost) first, child
    // (record_purchase) second. The sorter must flip them so the child is
    // revoked first.
    const dirtyKeys = ['view_product_cost', 'record_purchase']
    const state = { view_product_cost: false, record_purchase: false }
    expect(sortPermissionsForSave(dirtyKeys, state, catalog)).toEqual([
      'record_purchase',
      'view_product_cost'
    ])
  })

  it('grants the prerequisite before its dependent', () => {
    // Inverse direction. dirtyKeys can arrive in either order; output must
    // place the prereq (view_product_cost) before the dependent
    // (record_purchase).
    const dirtyKeys = ['record_purchase', 'view_product_cost']
    const state = { view_product_cost: true, record_purchase: true }
    expect(sortPermissionsForSave(dirtyKeys, state, catalog)).toEqual([
      'view_product_cost',
      'record_purchase'
    ])
  })

  it('orders revokes before grants in a mixed save', () => {
    // Revoking view_inventory_batches (independent) while granting
    // record_purchase (needs view_product_cost staged-on already).
    const dirtyKeys = [
      'view_inventory_batches',
      'view_product_cost',
      'record_purchase'
    ]
    const state = {
      view_inventory_batches: false, // revoke
      view_product_cost: true, // grant
      record_purchase: true // grant
    }
    const out = sortPermissionsForSave(dirtyKeys, state, catalog)
    expect(out[0]).toBe('view_inventory_batches')
    expect(out.indexOf('view_product_cost')).toBeLessThan(
      out.indexOf('record_purchase')
    )
  })

  it('returns independent keys in their original sub-order', () => {
    // Two unrelated revokes — neither depends on the other.
    const dirtyKeys = ['view_purchases', 'view_suppliers']
    const state = { view_purchases: false, view_suppliers: false }
    expect(sortPermissionsForSave(dirtyKeys, state, catalog)).toEqual([
      'view_purchases',
      'view_suppliers'
    ])
  })

  it('handles a 3-deep revoke chain', () => {
    // A → B → C (A requires B, B requires C). Revoke all three.
    // Expected order: A, B, C (deepest dependent first).
    const chain: CatalogRow[] = [row('c'), row('b', ['c']), row('a', ['b'])]
    const dirtyKeys = ['c', 'b', 'a']
    const state = { a: false, b: false, c: false }
    expect(sortPermissionsForSave(dirtyKeys, state, chain)).toEqual([
      'a',
      'b',
      'c'
    ])
  })
})
