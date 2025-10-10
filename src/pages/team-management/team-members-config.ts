export const STATUS_OPTIONS = ['Active', 'Invited', 'Inactive'] as const
export const ITEM_HEIGHT = 48
export const ITEM_PADDING_TOP = 8

export const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 260
    }
  }
}

export type MemberRow = {
  id: string
  name: string
  email: string
  role: string
  status: string
}
