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
    text: 'How does this month’s revenue compare to last month?',
    iconSrc: chartIcon
  },
  {
    text: 'Which expenses are growing fastest?',
    iconSrc: orangeFileIcon
  },
  {
    text: 'What’s my biggest expense category this month?',
    iconSrc: PinkPeopleIcon
  },
  {
    text: 'Which month has been my strongest so far this year?',
    iconSrc: purpleCalendarIcon
  }
]
