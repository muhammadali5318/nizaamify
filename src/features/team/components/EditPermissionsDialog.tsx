// v2.9.1 D.3 — Per-user permission editor.
//
// State model:
//   - On open: initialize `state` from useUserPermissions(targetUserId).
//   - Toggles mutate `state` locally. Dirty rows = state[key] !== initial[key].
//   - One-level dependency awareness in client (sufficient for ~90% of catalog;
//     deep transitives handled by server raise on Save).
//   - On Save: iterate dirty rows, call modify_user_permission per row. Errors
//     stop the loop and surface; user retries.
//
// Per ADR `2026-05-13-v291-permission-hooks-60s-cache`, the modify mutation
// invalidates the target user's permission cache + the team roster.

import { useEffect, useMemo, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Menu,
  MenuItem,
  Stack,
  Switch,
  Typography
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useTranslation } from 'react-i18next'
import { Badge, Button } from 'src/components/ui'
import {
  useApplyPresetToUser,
  useModifyUserPermission,
  usePermissionsCatalog,
  useUserPermissions,
  type CatalogRow
} from 'src/features/team/hooks'
import { mapErrorToI18nKey } from 'src/lib/errorMap'

type PermState = Record<string, boolean>

interface EditPermissionsDialogProps {
  open: boolean
  onClose: () => void
  member: {
    user_id: string
    email: string
    preset_applied: string | null
  } | null
}

interface DependencyPrompt {
  toggling: string
  direction: 'grant' | 'revoke'
  cascade: string[]
}

const CATEGORY_ORDER: CatalogRow['category'][] = [
  'sales',
  'products',
  'inventory',
  'customers',
  'suppliers',
  'financial',
  'settings',
  'team'
]

export function EditPermissionsDialog({
  open,
  onClose,
  member
}: EditPermissionsDialogProps) {
  const { t } = useTranslation('team')
  const catalogQ = usePermissionsCatalog()
  const userPermsQ = useUserPermissions(member?.user_id ?? null)
  const modify = useModifyUserPermission()
  const applyPreset = useApplyPresetToUser()

  const [initial, setInitial] = useState<PermState>({})
  const [state, setState] = useState<PermState>({})
  const [pendingDep, setPendingDep] = useState<DependencyPrompt | null>(null)
  const [savingIndex, setSavingIndex] = useState<number | null>(null)
  const [savingTotal, setSavingTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [presetMenuAnchor, setPresetMenuAnchor] =
    useState<HTMLButtonElement | null>(null)

  // Initialize state from query results
  useEffect(() => {
    if (!open) return
    const map: PermState = {}
    for (const row of userPermsQ.data ?? []) {
      map[row.permission_key] = row.granted
    }
    setInitial(map)
    setState(map)
    setError(null)
  }, [open, userPermsQ.data])

  const catalog = catalogQ.data ?? []
  const groupedByCategory = useMemo(() => {
    const map: Record<string, CatalogRow[]> = {}
    for (const cat of CATEGORY_ORDER) map[cat] = []
    for (const row of catalog) {
      if (!map[row.category]) map[row.category] = []
      map[row.category].push(row)
    }
    return map
  }, [catalog])

  const dirtyKeys = useMemo(
    () => Object.keys(state).filter((k) => state[k] !== initial[k]),
    [state, initial]
  )
  const hasChanges = dirtyKeys.length > 0

  if (!member) return null

  const handleToggle = (key: string, next: boolean) => {
    const row = catalog.find((c) => c.key === key)
    if (!row) return

    if (next) {
      // Grant: check requires[]; any prereq currently OFF needs cascade
      const missing = row.requires.filter((dep) => !state[dep])
      if (missing.length > 0) {
        setPendingDep({ toggling: key, direction: 'grant', cascade: missing })
        return
      }
      setState((s) => ({ ...s, [key]: true }))
    } else {
      // Revoke: find any granted perm whose requires[] includes this key
      const dependents = catalog
        .filter((c) => c.requires.includes(key) && state[c.key])
        .map((c) => c.key)
      if (dependents.length > 0) {
        setPendingDep({
          toggling: key,
          direction: 'revoke',
          cascade: dependents
        })
        return
      }
      setState((s) => ({ ...s, [key]: false }))
    }
  }

  const confirmDependency = () => {
    if (!pendingDep) return
    setState((s) => {
      const next = { ...s }
      const newValue = pendingDep.direction === 'grant'
      next[pendingDep.toggling] = newValue
      for (const k of pendingDep.cascade) next[k] = newValue
      return next
    })
    setPendingDep(null)
  }

  const handleApplyPreset = async (preset: 'manager' | 'salesperson') => {
    setPresetMenuAnchor(null)
    if (!member) return
    setError(null)
    try {
      await applyPreset.mutateAsync({
        target_user_id: member.user_id,
        preset
      })
      // Server reset all permissions; refetch will pick up the new state
      userPermsQ.refetch()
    } catch (err) {
      setError(mapErrorToI18nKey(err))
    }
  }

  const handleSave = async () => {
    if (!member || dirtyKeys.length === 0) return
    setError(null)
    setSavingTotal(dirtyKeys.length)
    for (let i = 0; i < dirtyKeys.length; i++) {
      const key = dirtyKeys[i]
      setSavingIndex(i)
      try {
        await modify.mutateAsync({
          target_user_id: member.user_id,
          permission_key: key,
          granted: state[key]
        })
      } catch (err) {
        setError(mapErrorToI18nKey(err))
        setSavingIndex(null)
        return
      }
    }
    setSavingIndex(null)
    onClose()
  }

  const isLoading = catalogQ.isLoading || userPermsQ.isLoading

  return (
    <Dialog
      open={open}
      onClose={savingIndex !== null ? undefined : onClose}
      maxWidth='md'
      fullWidth
      scroll='paper'
    >
      <DialogTitle>
        <Stack
          direction='row'
          justifyContent='space-between'
          alignItems='center'
          gap={2}
          flexWrap='wrap'
        >
          <Typography
            component='span'
            sx={{ fontWeight: 600, fontSize: '1.05rem' }}
          >
            {t('edit_permissions.dialog_title', { email: member.email })}
          </Typography>
          <Stack direction='row' alignItems='center' gap={1.5}>
            <Typography
              variant='caption'
              sx={{ color: 'var(--text-secondary)' }}
            >
              {t('edit_permissions.current_preset_label')}
            </Typography>
            <Badge variant='neutral'>
              {member.preset_applied
                ? member.preset_applied === 'manager'
                  ? t('members.preset_manager')
                  : t('members.preset_salesperson')
                : t('members.preset_custom')}
            </Badge>
            <Button
              size='sm'
              variant='secondary'
              onClick={(e) => setPresetMenuAnchor(e.currentTarget)}
              loading={applyPreset.isPending}
            >
              {t('edit_permissions.apply_preset')}
            </Button>
            <Menu
              open={!!presetMenuAnchor}
              anchorEl={presetMenuAnchor}
              onClose={() => setPresetMenuAnchor(null)}
            >
              <MenuItem onClick={() => void handleApplyPreset('manager')}>
                {t('members.preset_manager')}
              </MenuItem>
              <MenuItem onClick={() => void handleApplyPreset('salesperson')}>
                {t('members.preset_salesperson')}
              </MenuItem>
            </Menu>
          </Stack>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Stack gap={1}>
            {CATEGORY_ORDER.map((cat) => (
              <CategorySection
                key={cat}
                category={cat}
                rows={groupedByCategory[cat] ?? []}
                state={state}
                onToggle={handleToggle}
                disabled={savingIndex !== null}
              />
            ))}
          </Stack>
        )}
        {error && (
          <Alert severity='error' sx={{ mt: 2 }}>
            {t(`common:${error}`)}
          </Alert>
        )}
        {savingIndex !== null && (
          <Box sx={{ mt: 2 }}>
            <Typography variant='caption'>
              {t('edit_permissions.saving')} ({savingIndex + 1}/{savingTotal})
            </Typography>
            <LinearProgress
              variant='determinate'
              value={
                savingTotal > 0 ? ((savingIndex + 1) / savingTotal) * 100 : 0
              }
              sx={{ mt: 0.5 }}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button
          variant='secondary'
          onClick={onClose}
          disabled={savingIndex !== null}
        >
          {t('common:actions.cancel')}
        </Button>
        <Button
          loading={savingIndex !== null}
          disabled={!hasChanges}
          onClick={() => void handleSave()}
        >
          {hasChanges
            ? t('edit_permissions.save')
            : t('edit_permissions.no_changes')}
        </Button>
      </DialogActions>

      {/* Dependency confirmation dialog (nested) */}
      <Dialog
        open={!!pendingDep}
        onClose={() => setPendingDep(null)}
        maxWidth='xs'
        fullWidth
      >
        <DialogTitle>
          {pendingDep?.direction === 'grant'
            ? t('edit_permissions.dependency_grant_title')
            : t('edit_permissions.dependency_revoke_title')}
        </DialogTitle>
        <DialogContent>
          <Typography variant='body2'>
            {t(
              pendingDep?.direction === 'grant'
                ? 'edit_permissions.dependency_grant_body'
                : 'edit_permissions.dependency_revoke_body',
              {
                permission: pendingDep
                  ? labelForKey(catalog, pendingDep.toggling)
                  : '',
                prereqs: pendingDep?.cascade
                  .map((k) => labelForKey(catalog, k))
                  .join(', '),
                dependents: pendingDep?.cascade
                  .map((k) => labelForKey(catalog, k))
                  .join(', ')
              }
            )}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button variant='secondary' onClick={() => setPendingDep(null)}>
            {t('edit_permissions.back')}
          </Button>
          <Button onClick={confirmDependency}>
            {t('edit_permissions.continue')}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------

function CategorySection({
  category,
  rows,
  state,
  onToggle,
  disabled
}: {
  category: CatalogRow['category']
  rows: CatalogRow[]
  state: PermState
  onToggle: (key: string, next: boolean) => void
  disabled: boolean
}) {
  const { t } = useTranslation('team')
  const granted = rows.filter((r) => state[r.key]).length
  const total = rows.length

  return (
    <Accordion
      defaultExpanded
      disableGutters
      sx={{
        backgroundColor: 'transparent',
        borderRadius: 'var(--radius-md) !important',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'none',
        '&:before': { display: 'none' }
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack
          direction='row'
          justifyContent='space-between'
          alignItems='center'
          gap={2}
          sx={{ width: '100%', mr: 1 }}
        >
          <Typography sx={{ fontWeight: 600 }}>
            {t(`edit_permissions.category_${category}`)}
          </Typography>
          <Typography
            variant='caption'
            sx={{
              color:
                granted === total
                  ? 'var(--text-brand)'
                  : 'var(--text-secondary)'
            }}
          >
            {t('edit_permissions.section_granted_count', {
              count: granted,
              total
            })}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        <Stack
          divider={<Box sx={{ borderTop: '1px solid var(--border-subtle)' }} />}
        >
          {rows.map((row) => (
            <PermissionRow
              key={row.key}
              row={row}
              granted={!!state[row.key]}
              onToggle={(next) => onToggle(row.key, next)}
              disabled={disabled}
            />
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  )
}

function PermissionRow({
  row,
  granted,
  onToggle,
  disabled
}: {
  row: CatalogRow
  granted: boolean
  onToggle: (next: boolean) => void
  disabled: boolean
}) {
  return (
    <Stack
      direction='row'
      alignItems='center'
      justifyContent='space-between'
      gap={2}
      sx={{ py: 1 }}
    >
      <Stack sx={{ flex: 1, minWidth: 0 }} gap={0.25}>
        <Typography variant='body2' sx={{ fontWeight: 500 }}>
          {row.name}
        </Typography>
        <Typography
          variant='caption'
          sx={{ color: 'var(--text-secondary)', lineHeight: 1.3 }}
        >
          {row.description}
        </Typography>
      </Stack>
      <Switch
        checked={granted}
        onChange={(e) => onToggle(e.target.checked)}
        disabled={disabled}
        inputProps={{ 'aria-label': row.name }}
      />
    </Stack>
  )
}

function labelForKey(catalog: CatalogRow[], key: string): string {
  return catalog.find((c) => c.key === key)?.name ?? key
}

export default EditPermissionsDialog
