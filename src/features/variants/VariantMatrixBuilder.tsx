import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Checkbox from '@mui/material/Checkbox'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import CloseIcon from '@mui/icons-material/Close'
import { useTranslation } from 'react-i18next'
import {
  Banner,
  Field,
  Input,
  Tooltip,
  type DataTableColumn,
  DataTable
} from 'src/components/ui'
import {
  useAttributeValues,
  useVariantAttributes,
  type VariantAttribute,
  type VariantAttributeValue
} from './hooks'

const MAX_ATTRIBUTES = 3

export type MatrixVariantSpec = {
  /** Stable key — sorted, joined value ids — for React keys and dedup. */
  key: string
  /** Ordered (parallel to attributeIds) value ids that make up this combo. */
  attribute_value_ids: string[]
  /** Human label like "Red / M". */
  label: string
  sku: string
  price: string
  opening_stock: string
}

export type VariantMatrixState = {
  attributeIds: string[]
  selectedValues: Record<string, string[]>
  /** Inclusion flags by combo key. true when the combo will be created. */
  included: Record<string, boolean>
  /** SKU + price + opening_stock overrides per combo. */
  overrides: Record<
    string,
    { sku?: string; price?: string; opening_stock?: string }
  >
}

type Props = {
  state: VariantMatrixState
  onChange: (next: VariantMatrixState) => void
  productNameForSku: string
  defaultPrice: string
  onDefaultPriceChange: (next: string) => void
  /** v2.7 polish: default opening cost-per-unit applied to every variant
   * whose Opening qty > 0. Required (server-side) when any variant has
   * opening stock; ignored otherwise. */
  defaultOpeningCost: string
  onDefaultOpeningCostChange: (next: string) => void
  errorText?: string | null
}

function comboKey(valueIds: string[]): string {
  return [...valueIds].join('|')
}

/** Cross-product of arrays preserving order. */
function crossProduct<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return []
  return arrays.reduce<T[][]>(
    (acc, arr) => acc.flatMap((prefix) => arr.map((x) => [...prefix, x])),
    [[]]
  )
}

function autoSkuFor(productName: string, valueLabels: string[]): string {
  const namePart = (productName || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 2)
    .toUpperCase()
  const valueParts = valueLabels.map((v) =>
    v
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 3)
      .toUpperCase()
  )
  return [namePart, ...valueParts].filter(Boolean).join('-')
}

export default function VariantMatrixBuilder({
  state,
  onChange,
  productNameForSku,
  defaultPrice,
  onDefaultPriceChange,
  defaultOpeningCost,
  onDefaultOpeningCostChange,
  errorText
}: Props) {
  const { t } = useTranslation(['variants', 'common'])
  const { data: attributes = [] } = useVariantAttributes()

  const set = (patch: Partial<VariantMatrixState>) =>
    onChange({ ...state, ...patch })

  const handleAddAttribute = (id: string) => {
    if (state.attributeIds.includes(id)) return
    if (state.attributeIds.length >= MAX_ATTRIBUTES) return
    set({
      attributeIds: [...state.attributeIds, id],
      selectedValues: { ...state.selectedValues, [id]: [] }
    })
  }

  const handleRemoveAttribute = (id: string) => {
    const nextSelected = { ...state.selectedValues }
    delete nextSelected[id]
    set({
      attributeIds: state.attributeIds.filter((x) => x !== id),
      selectedValues: nextSelected,
      // Reset overrides + included; the combos will be re-derived
      included: {},
      overrides: {}
    })
  }

  const handleToggleValue = (attrId: string, valueId: string) => {
    const current = state.selectedValues[attrId] ?? []
    const next = current.includes(valueId)
      ? current.filter((x) => x !== valueId)
      : [...current, valueId]
    set({
      selectedValues: { ...state.selectedValues, [attrId]: next }
    })
  }

  return (
    <Stack spacing={2}>
      <Typography variant='caption' sx={{ color: 'var(--text-muted)' }}>
        {t('variants:select_attributes')}
      </Typography>

      {errorText && <Banner variant='error'>{errorText}</Banner>}

      {state.attributeIds.map((attrId) => {
        const attr = attributes.find((a) => a.id === attrId)
        if (!attr) return null
        return (
          <AttributeValuePicker
            key={attrId}
            attribute={attr}
            selectedValueIds={state.selectedValues[attrId] ?? []}
            onToggleValue={(id) => handleToggleValue(attrId, id)}
            onRemove={() => handleRemoveAttribute(attrId)}
          />
        )
      })}

      {state.attributeIds.length < MAX_ATTRIBUTES && (
        <AddAttributeMenu
          attributes={attributes.filter(
            (a) => !state.attributeIds.includes(a.id)
          )}
          onPick={handleAddAttribute}
        />
      )}

      {/* Combination matrix + variant list (derived state). */}
      {state.attributeIds.length > 0 && (
        <CombinationMatrix
          attributeIds={state.attributeIds}
          selectedValues={state.selectedValues}
          state={state}
          onChange={onChange}
          productNameForSku={productNameForSku}
          defaultPrice={defaultPrice}
          onDefaultPriceChange={onDefaultPriceChange}
          defaultOpeningCost={defaultOpeningCost}
          onDefaultOpeningCostChange={onDefaultOpeningCostChange}
        />
      )}
    </Stack>
  )
}

function AttributeValuePicker({
  attribute,
  selectedValueIds,
  onToggleValue,
  onRemove
}: {
  attribute: VariantAttribute
  selectedValueIds: string[]
  onToggleValue: (id: string) => void
  onRemove: () => void
}) {
  const { t } = useTranslation(['variants', 'common'])
  const { data: values = [], isLoading } = useAttributeValues(attribute.id)

  return (
    <Box
      sx={{
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        p: 1.5
      }}
    >
      <Stack direction='row' alignItems='center' justifyContent='space-between'>
        <Typography variant='body1' sx={{ fontWeight: 600 }}>
          {attribute.name}
        </Typography>
        <Tooltip title={t('variants:actions.remove')}>
          <IconButton size='small' onClick={onRemove}>
            <CloseIcon fontSize='small' />
          </IconButton>
        </Tooltip>
      </Stack>
      <Typography
        variant='caption'
        sx={{ color: 'var(--text-muted)', display: 'block', mb: 1 }}
      >
        {t('variants:select_values')}
      </Typography>
      {isLoading ? (
        <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
          {t('common:loading')}
        </Typography>
      ) : values.length === 0 ? (
        <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
          {t('variants:no_values_yet')}
        </Typography>
      ) : (
        <Stack direction='row' spacing={0.75} flexWrap='wrap' useFlexGap>
          {values.map((v) => (
            <ValueChip
              key={v.id}
              value={v}
              selected={selectedValueIds.includes(v.id)}
              onToggle={() => onToggleValue(v.id)}
            />
          ))}
        </Stack>
      )}
    </Box>
  )
}

function ValueChip({
  value,
  selected,
  onToggle
}: {
  value: VariantAttributeValue
  selected: boolean
  onToggle: () => void
}) {
  return (
    <Box
      role='button'
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
      sx={{
        cursor: 'pointer',
        userSelect: 'none',
        px: 1.5,
        py: 0.5,
        borderRadius: 'var(--radius-md)',
        backgroundColor: selected
          ? 'var(--status-brand-bg)'
          : 'var(--surface-muted)',
        color: selected ? 'var(--text-brand)' : 'inherit',
        fontWeight: selected ? 600 : 400,
        border: selected
          ? '1px solid var(--text-brand)'
          : '1px solid transparent',
        transition:
          'background-color var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out)'
      }}
    >
      {value.value}
    </Box>
  )
}

function AddAttributeMenu({
  attributes,
  onPick
}: {
  attributes: VariantAttribute[]
  onPick: (id: string) => void
}) {
  const { t } = useTranslation(['variants'])
  if (attributes.length === 0) return null
  // Picking from the dropdown immediately adds the attribute — there's no
  // separate "Add" button click. (Earlier design had a button, which trapped
  // users who expected the dropdown to take effect on its own.)
  return (
    <TextField
      select
      size='small'
      value=''
      onChange={(e) => {
        const v = e.target.value
        if (v) onPick(v)
      }}
      label={t('variants:actions.add_attribute')}
      sx={{ minWidth: 280 }}
    >
      {attributes.map((a) => (
        <MenuItem key={a.id} value={a.id}>
          {a.name}
          {a.value_count === 0 && (
            <Typography
              component='span'
              variant='caption'
              sx={{ ml: 1, color: 'var(--text-muted)' }}
            >
              ({t('variants:no_values_yet')})
            </Typography>
          )}
        </MenuItem>
      ))}
    </TextField>
  )
}

function CombinationMatrix({
  attributeIds,
  selectedValues,
  state,
  onChange,
  productNameForSku,
  defaultPrice,
  onDefaultPriceChange,
  defaultOpeningCost,
  onDefaultOpeningCostChange
}: {
  attributeIds: string[]
  selectedValues: Record<string, string[]>
  state: VariantMatrixState
  onChange: (next: VariantMatrixState) => void
  productNameForSku: string
  defaultPrice: string
  onDefaultPriceChange: (next: string) => void
  defaultOpeningCost: string
  onDefaultOpeningCostChange: (next: string) => void
}) {
  const { t } = useTranslation(['variants', 'common'])
  const { data: attributes = [] } = useVariantAttributes()

  // Pull values for every selected attribute (one hook per attribute via map
  // would break the rules; instead we read once per attribute and merge).
  const valuesByAttrId = useAttributeValuesMap(attributeIds)

  // Build the cross-product
  const combos = useMemo<MatrixVariantSpec[]>(() => {
    const lists = attributeIds.map((aid) => {
      const valueIds = selectedValues[aid] ?? []
      const lookup = valuesByAttrId.get(aid) ?? new Map()
      return valueIds.map((vid) => ({
        id: vid,
        value: lookup.get(vid)?.value ?? '?'
      }))
    })
    if (lists.some((l) => l.length === 0)) return []
    const xp = crossProduct(lists)
    return xp.map((tuple) => {
      const value_ids = tuple.map((x) => x.id)
      const labels = tuple.map((x) => x.value)
      const key = comboKey(value_ids)
      const override = state.overrides[key] ?? {}
      return {
        key,
        attribute_value_ids: value_ids,
        label: labels.join(' / '),
        sku: override.sku ?? autoSkuFor(productNameForSku, labels),
        price: override.price ?? defaultPrice,
        opening_stock: override.opening_stock ?? '0'
      }
    })
  }, [
    attributeIds,
    selectedValues,
    valuesByAttrId,
    state.overrides,
    productNameForSku,
    defaultPrice
  ])

  // Default every combo to included when the keys first appear
  useEffect(() => {
    let dirty = false
    const next: Record<string, boolean> = { ...state.included }
    const validKeys = new Set(combos.map((c) => c.key))
    for (const c of combos) {
      if (!(c.key in next)) {
        next[c.key] = true
        dirty = true
      }
    }
    // Drop included flags for combos that no longer exist
    for (const k of Object.keys(next)) {
      if (!validKeys.has(k)) {
        delete next[k]
        dirty = true
      }
    }
    if (dirty) onChange({ ...state, included: next })
  }, [combos])

  const includedCount = combos.filter((c) => state.included[c.key]).length

  if (combos.length === 0) return null

  return (
    <Stack spacing={1.5}>
      <Divider sx={{ borderColor: 'var(--border-subtle)' }} />
      <Typography variant='overline' sx={{ color: 'var(--text-muted)' }}>
        {t('variants:variants_list_title')}
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Field
          label={t('variants:default_price_label')}
          hint={t('variants:default_price_help')}
        >
          <Input
            type='number'
            inputProps={{ step: '0.01', min: 0, inputMode: 'numeric' }}
            value={defaultPrice}
            onChange={(e) => onDefaultPriceChange(e.target.value)}
          />
        </Field>
        <Field
          label={t('variants:default_opening_cost_label')}
          hint={t('variants:default_opening_cost_help')}
        >
          <Input
            type='number'
            inputProps={{ step: '0.01', min: 0, inputMode: 'numeric' }}
            value={defaultOpeningCost}
            onChange={(e) => onDefaultOpeningCostChange(e.target.value)}
          />
        </Field>
      </Stack>

      <Typography variant='body2' sx={{ color: 'var(--text-muted)' }}>
        {t('variants:variants_will_be_created', {
          count: includedCount,
          defaultValue_one: `${includedCount} variant will be created.`,
          defaultValue_other: `${includedCount} variants will be created.`
        })}{' '}
        {t('variants:matrix_uncheck_help')}
      </Typography>

      <ComboTable
        combos={combos}
        attributes={attributes.filter((a) => attributeIds.includes(a.id))}
        state={state}
        onChange={onChange}
      />
    </Stack>
  )
}

function ComboTable({
  combos,
  attributes,
  state,
  onChange
}: {
  combos: MatrixVariantSpec[]
  attributes: VariantAttribute[]
  state: VariantMatrixState
  onChange: (next: VariantMatrixState) => void
}) {
  const { t } = useTranslation(['variants'])

  const setIncluded = (key: string, included: boolean) => {
    onChange({
      ...state,
      included: { ...state.included, [key]: included }
    })
  }
  const setOverride = (
    key: string,
    field: 'sku' | 'price' | 'opening_stock',
    value: string
  ) => {
    onChange({
      ...state,
      overrides: {
        ...state.overrides,
        [key]: { ...state.overrides[key], [field]: value }
      }
    })
  }

  const columns: DataTableColumn<MatrixVariantSpec>[] = [
    {
      id: 'include',
      header: '',
      align: 'center',
      width: 56,
      cell: (row) => (
        <Checkbox
          checked={!!state.included[row.key]}
          onChange={(e) => setIncluded(row.key, e.target.checked)}
        />
      )
    },
    {
      id: 'variant',
      header: t('variants:columns.variant'),
      cell: (row) => (
        <Typography variant='body1' sx={{ fontWeight: 500 }}>
          {row.label}
        </Typography>
      )
    },
    {
      id: 'sku',
      header: t('variants:columns.sku'),
      cell: (row) => (
        <Input
          value={row.sku}
          onChange={(e) => setOverride(row.key, 'sku', e.target.value)}
          inputProps={{ maxLength: 40 }}
        />
      )
    },
    {
      id: 'price',
      header: t('variants:columns.price'),
      align: 'end',
      cell: (row) => (
        <Input
          type='number'
          inputProps={{ step: '0.01', min: 0, inputMode: 'numeric' }}
          value={row.price}
          onChange={(e) => setOverride(row.key, 'price', e.target.value)}
        />
      )
    },
    {
      id: 'opening_stock',
      header: t('variants:columns.opening_stock'),
      align: 'end',
      cell: (row) => (
        <Input
          type='number'
          inputProps={{ step: '1', min: 0, inputMode: 'numeric' }}
          value={row.opening_stock}
          onChange={(e) =>
            setOverride(row.key, 'opening_stock', e.target.value)
          }
        />
      )
    }
  ]

  // Keep attributes referenced so a future polish step can render a per-row
  // attribute label fallback when label is empty (defensive).
  void attributes

  return (
    <DataTable
      columns={columns}
      rows={combos}
      getRowId={(row) => row.key}
      ariaLabel={t('variants:variants_list_title')}
    />
  )
}

/**
 * Loads attribute values for every attribute id at once. Returns a Map from
 * attribute_id → Map<value_id, value-row>. Internally uses a single hook
 * call that batches by attribute_id via .in() under the hood (Postgres handles
 * the RLS chain for us).
 */
function useAttributeValuesMap(attributeIds: string[]) {
  const sorted = useMemo(() => [...attributeIds].sort(), [attributeIds])
  const key = sorted.join(',')
  // Hooks are called once per render — fetch in a single query. We can't
  // call useAttributeValues per id (hook order rule), so a tiny supabase
  // .in() query is the cleanest path.
  return useBatchedAttributeValues(sorted, key)
}

function useBatchedAttributeValues(
  attributeIds: string[],
  _cacheKey: string
): Map<string, Map<string, VariantAttributeValue>> {
  // Empty in → empty out
  const enabled = attributeIds.length > 0
  const map = useMemo(
    () => new Map<string, Map<string, VariantAttributeValue>>(),
    [_cacheKey]
  )
  // Lazy-import to avoid a circular dep with hooks.ts
  const [version, setVersion] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void (async () => {
      const { supabase } = await import('src/lib/supabase')
      const { data, error } = await supabase
        .from('variant_attribute_values')
        .select('id, value, display_order, attribute_id, is_active')
        .in('attribute_id', attributeIds)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
      if (cancelled || error || !data) return
      map.clear()
      for (const row of data) {
        if (!map.has(row.attribute_id)) map.set(row.attribute_id, new Map())
        map.get(row.attribute_id)!.set(row.id, {
          id: row.id,
          value: row.value,
          display_order: row.display_order ?? 0
        })
      }
      setVersion((v) => v + 1)
    })()
    return () => {
      cancelled = true
    }
  }, [_cacheKey])
  void version
  return map
}
