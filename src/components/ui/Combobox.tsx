import { forwardRef } from 'react'
import Autocomplete, {
  type AutocompleteProps,
  type AutocompleteValue
} from '@mui/material/Autocomplete'
import TextField, { type TextFieldProps } from '@mui/material/TextField'

type Multiple = boolean | undefined
type DisableClearable = boolean | undefined
type FreeSolo = boolean | undefined

export interface ComboboxProps<
  T,
  M extends Multiple = false,
  D extends DisableClearable = false,
  F extends FreeSolo = false
> extends Omit<AutocompleteProps<T, M, D, F>, 'renderInput'> {
  /** Input label (passed through to the inner TextField). */
  label?: TextFieldProps['label']
  /** Placeholder shown when nothing is selected. */
  placeholder?: TextFieldProps['placeholder']
  /** Forwarded onto the TextField slot — useful for `error`, `helperText`. */
  textFieldProps?: Omit<TextFieldProps, 'label' | 'placeholder'>
}

/**
 * Searchable autocomplete (spec §6). Wrap MUI Autocomplete with our token
 * styling and a built-in TextField renderer so callers don't repeat the
 * `renderInput` boilerplate. Use for customer picker, product type
 * autocomplete, etc.
 */
function ComboboxInner<
  T,
  M extends Multiple = false,
  D extends DisableClearable = false,
  F extends FreeSolo = false
>(
  { label, placeholder, textFieldProps, ...rest }: ComboboxProps<T, M, D, F>,
  ref: React.Ref<HTMLDivElement>
) {
  return (
    <Autocomplete
      ref={ref}
      autoHighlight
      autoComplete
      blurOnSelect
      renderInput={(params) => (
        <TextField
          {...params}
          {...textFieldProps}
          label={label}
          placeholder={placeholder}
        />
      )}
      {...rest}
    />
  )
}

export const Combobox = forwardRef(ComboboxInner) as <
  T,
  M extends Multiple = false,
  D extends DisableClearable = false,
  F extends FreeSolo = false
>(
  props: ComboboxProps<T, M, D, F> & { ref?: React.Ref<HTMLDivElement> }
) => ReturnType<typeof ComboboxInner>

export type { AutocompleteValue }

export default Combobox
