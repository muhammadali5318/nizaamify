import { Box, TextField, IconButton, InputAdornment } from '@mui/material'
import SendIcon from 'src/assets/PaperPlaneRight.svg'

interface Props {
  value: string
  onChange: (value: string) => void
  onSend: (value: string) => void
  disabled?: boolean
}

const ChatInput = ({ value, onChange, onSend, disabled }: Props) => {
  const handleSend = () => {
    if (!value.trim()) return
    onSend(value)
  }

  return (
    <Box>
      <TextField
        fullWidth
        placeholder='Ask me anything about your practice...'
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position='end'>
                <IconButton
                  disabled={disabled || !value.trim()}
                  onClick={handleSend}
                  edge='end'
                >
                  <img src={SendIcon} alt='send' />
                </IconButton>
              </InputAdornment>
            )
          }
        }}
      />
    </Box>
  )
}

export default ChatInput
