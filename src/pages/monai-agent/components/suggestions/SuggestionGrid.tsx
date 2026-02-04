import { Box } from '@mui/material'
import SuggestionCard from './SuggestionCard'
import { SUGGESTIONS } from '../../constants/suggestions'

interface Props {
  onSelect: (text: string) => void
}

const SuggestionGrid = ({ onSelect }: Props) => {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        gap: 2,
        maxWidth: 900
      }}
    >
      {SUGGESTIONS.map((item) => (
        <SuggestionCard
          key={item.text}
          text={item.text}
          iconSrc={item.iconSrc}
          onClick={() => onSelect(item.text)}
        />
      ))}
    </Box>
  )
}

export default SuggestionGrid
