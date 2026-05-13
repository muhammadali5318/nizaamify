// Topological ordering for permission save.
//
// EditPermissionsDialog stages multiple toggle changes locally, then saves
// them one-at-a-time via `modify_user_permission`. The server validator
// rejects a revoke whose dependent is still granted in the DB, and a grant
// whose prerequisite is still revoked — so the order the dirty keys are
// sent matters. Sending them in catalog `display_order` (the natural order
// of `Object.keys(state)`) is wrong: a parent permission can precede its
// child, and the parent's revoke is rejected because the child is still
// granted in the DB.
//
// Output order:
//   - Revokes first, dependent → dependency.
//   - Grants next, prerequisite → dependent.

import type { CatalogRow } from 'src/features/team/hooks'

export function sortPermissionsForSave(
  dirtyKeys: string[],
  state: Record<string, boolean>,
  catalog: CatalogRow[]
): string[] {
  const grants = dirtyKeys.filter((k) => state[k])
  const revokes = dirtyKeys.filter((k) => !state[k])

  const byKey = new Map(catalog.map((c) => [c.key, c]))
  const grantSet = new Set(grants)

  const orderRevokes = (): string[] => {
    const out: string[] = []
    const visited = new Set<string>()
    const visit = (k: string) => {
      if (visited.has(k)) return
      visited.add(k)
      for (const other of revokes) {
        if (other === k) continue
        const row = byKey.get(other)
        if (row?.requires.includes(k)) visit(other)
      }
      out.push(k)
    }
    for (const k of revokes) visit(k)
    return out
  }

  const orderGrants = (): string[] => {
    const out: string[] = []
    const visited = new Set<string>()
    const visit = (k: string) => {
      if (visited.has(k)) return
      visited.add(k)
      const row = byKey.get(k)
      for (const req of row?.requires ?? []) {
        if (grantSet.has(req)) visit(req)
      }
      out.push(k)
    }
    for (const k of grants) visit(k)
    return out
  }

  return [...orderRevokes(), ...orderGrants()]
}
