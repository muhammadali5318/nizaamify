import { Box } from '@mui/material'
import SuggestionCard from './SuggestionCard'
import { SUGGESTIONS } from '../../constants/suggestions'

const SuggestionGrid = () => {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
        gap: 2,
        maxWidth: 900
      }}
    >
      {SUGGESTIONS.map((item) => (
        <Box key={item.text}>
          <SuggestionCard text={item.text} iconSrc={item.iconSrc} />
        </Box>
      ))}
    </Box>
  )
}

export default SuggestionGrid
