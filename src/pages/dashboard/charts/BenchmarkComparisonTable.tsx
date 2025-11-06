import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow
} from '@mui/material'

const data = [
  ['Staff costs', '35%', '22-30%', '21.3%'],
  ['Clinician pay', '40%', '38-45%', '35-45%'],
  ['Lab fees', '6%', '5.5-6.5%', '4.6%'],
  ['Materials', '6.5%', '5.5-6.5%', '4.9%'],
  ['Premises & utilities', '4.2%', '3.9-4.1%', '3.8%'],
  ['Marketing', '5.5%', '1-2%', '0.5-2%'],
  ['Net profit margin', '14%', '12-22%', '8-16%']
]

const BenchmarkComparisonTable = () => (
  <Card sx={{ backgroundColor: '#FAFAFA' }}>
    <CardContent>
      <Table size='small'>
        <TableHead>
          <TableRow>
            <TableCell>Category</TableCell>
            <TableCell>Your practice revenue</TableCell>
            <TableCell>Monai benchmark</TableCell>
            <TableCell>UK Avg (NHS)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row, i) => (
            <TableRow key={i}>
              {row.map((cell, j) => (
                <TableCell key={j}>{cell}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
)

export default BenchmarkComparisonTable
