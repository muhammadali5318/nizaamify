// Design-system primitives (v1.7). Import from this barrel only.
// Each export becomes available as: import { X } from 'src/components/ui'.

// Phase C primitives are added file-by-file. As each lands it appears here.
export {
  Button,
  type ButtonProps,
  type ButtonVariant,
  type ButtonSize
} from './Button'
export { Field, type FieldProps } from './Field'
export { Input, type InputProps, type InputSize } from './Input'
export { Textarea, type TextareaProps } from './Textarea'
export { Badge, type BadgeProps, type BadgeVariant } from './Badge'
export { Card, type CardProps, type CardVariant } from './Card'
export { Banner, type BannerProps, type BannerVariant } from './Banner'
export { EmptyState, type EmptyStateProps } from './EmptyState'
export {
  Skeleton,
  TableRowSkeleton,
  type SkeletonProps,
  type TableRowSkeletonProps
} from './Skeleton'
export { Pagination, type PaginationProps } from './Pagination'
export {
  DataTable,
  type DataTableColumn,
  type DataTableProps,
  type DataTableSort,
  type DataTableMenuAction,
  type ColumnAlign
} from './DataTable'
export {
  Dialog,
  ConfirmDialog,
  type DialogProps,
  type ConfirmDialogProps
} from './Dialog'
export { Drawer, type DrawerProps } from './Drawer'
