import { Box, TextField, IconButton, InputAdornment } from '@mui/material'
import SendIcon from 'src/assets/PaperPlaneRight.svg'
import { useState } from 'react'

interface Props {
  onSend: (value: string) => void
  disabled?: boolean
}

const ChatInput = ({ onSend, disabled }: Props) => {
  const [value, setValue] = useState('')

  const handleSend = () => {
    if (!value.trim()) return
    onSend(value)
    setValue('')
  }

  return (
    <Box mb={2}>
      <TextField
        fullWidth
        placeholder='Ask me anything about your practice...'
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position='end'>
                <IconButton
                  color='primary'
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
