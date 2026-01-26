import { ListItemButton, ListItemText } from '@mui/material'

interface Props {
  title: string
}

const ChatHistoryItem = ({ title }: Props) => {
  return (
    <ListItemButton>
      <ListItemText primary={title} />
    </ListItemButton>
  )
}

export default ChatHistoryItem
