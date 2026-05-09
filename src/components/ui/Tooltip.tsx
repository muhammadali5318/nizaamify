import MuiTooltip, {
  type TooltipProps as MuiTooltipProps
} from '@mui/material/Tooltip'

export type TooltipProps = MuiTooltipProps

/**
 * Thin MUI Tooltip wrapper (spec §6 / §11). Uses the theme's enterDelay=200ms
 * default. Always pair an icon-only button with a tooltip whose text matches
 * the button's aria-label so sighted and screen-reader users get the same
 * label.
 */
export function Tooltip(props: TooltipProps) {
  return <MuiTooltip arrow {...props} />
}

export default Tooltip
