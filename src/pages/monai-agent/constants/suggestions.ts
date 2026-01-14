import upTrendIcon from 'src/assets/uptrend-icon.svg'
import chartIcon from 'src/assets/chart-icon.svg'
import PinkPeopleIcon from 'src/assets/pink-people.svg'
import dollarIcon from 'src/assets/dollar.svg'
import orangeFileIcon from 'src/assets/orange-file.svg'
import purpleCalendarIcon from 'src/assets/purple-calendar.svg'

export const SUGGESTIONS = [
  {
    text: "What's my current profit margin?",
    iconSrc: dollarIcon
  },
  {
    text: 'Show me revenue trends for last 6 months',
    iconSrc: upTrendIcon
  },
  {
    text: 'Compare my expenses with similar practices',
    iconSrc: chartIcon
  },
  {
    text: 'Which expenses are growing fastest?',
    iconSrc: orangeFileIcon
  },
  {
    text: 'How many active patients do I have?',
    iconSrc: PinkPeopleIcon
  },
  {
    text: "What's my appointment utilisation rate?",
    iconSrc: purpleCalendarIcon
  }
]
