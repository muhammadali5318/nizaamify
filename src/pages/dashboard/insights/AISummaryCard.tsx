import {
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  Box
} from '@mui/material'

import aiIcon from '../../../assets/ai-summary-icon.svg'

const AISummaryCard = () => (
  <Card sx={{ minHeight: '246px' }}>
    <CardContent>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'flex-start',
          alignItems: 'start',
          gap: 1,
          mb: 1
        }}
      >
        <img src={aiIcon} alt='Revenue vs Cost' />
        <Typography variant='h6' mb={1}>
          AI Summary
        </Typography>
      </Box>
      <List dense>
        <ListItem>
          <ListItemText primary='Net profit increased by £1,500 (+14.3%) due to reduced lab spend and higher patient volume.' />
        </ListItem>
        <ListItem>
          <ListItemText primary='Staff costs are 2.3% higher than benchmark – consider reviewing locum usage.' />
        </ListItem>
        <ListItem>
          <ListItemText primary='Utilities were £200 above historical average – check for efficiency improvements.' />
        </ListItem>
      </List>
    </CardContent>
  </Card>
)

export default AISummaryCard
