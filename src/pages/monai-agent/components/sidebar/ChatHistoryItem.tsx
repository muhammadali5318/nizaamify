import { Box, ListItemButton, Typography } from '@mui/material'
import { formatChatDate } from 'src/utils/stringUtils'

interface Props {
  chatMetaData: any
  onClick: () => void
  selected?: boolean
}

const ChatHistoryItem = ({ chatMetaData, selected, onClick }: Props) => {
  return (
    <ListItemButton
      onClick={onClick}
      selected={selected}
      sx={{
        p: '8px 8px 8px 16px',
        mb: '4px',
        borderRadius: '12px',

        border: '1px solid transparent',
        backgroundColor: 'transparent',

        '&.Mui-selected': {
          border: '1px solid var(--grey-300, #E0E0E0)',
          backgroundColor: 'var(--grey-300, #E0E0E0)'
        },

        '&.Mui-selected:hover': {
          border: '1px solid var(--grey-300, #E0E0E0)',
          backgroundColor: 'var(--grey-300, #E0E0E0)'
        }
      }}
    >
      <Box sx={{ width: '100%' }}>
        {/* Title */}
        <Typography variant='subtitle2' fontWeight={500}>
          {chatMetaData?.title}
        </Typography>

        {/* Date / Time */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <img
            src='/assets/clock.svg'
            alt='clock icon'
            width={14}
            height={14}
          />
          <Typography mt={0.2} variant='caption' color='text.secondary'>
            {formatChatDate(chatMetaData?.created_at)}
          </Typography>
        </Box>
      </Box>
    </ListItemButton>
  )
}

export default ChatHistoryItem
