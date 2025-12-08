import { GridColDef } from '@mui/x-data-grid'
import dayjs from 'dayjs'
import downloadImg from '../../../assets/document-download.svg'
export const invoiceColumns: GridColDef[] = [
  {
    field: 'number',
    headerName: 'Invoice Number',
    minWidth: 180,
    flex: 1
  },
  {
    field: 'period_start',
    headerName: 'Purchase date',
    minWidth: 140,
    valueFormatter: (params: any) =>
      params ? dayjs(params).format(' DD/MM/YYYY') : '/'
  },
  {
    field: 'period_end',
    headerName: 'Billing date',
    minWidth: 140,
    valueFormatter: (params: any) =>
      params ? dayjs(params).format(' DD/MM/YYYY') : '/'
  },
  {
    field: 'amount',
    headerName: 'Amount (£)',
    minWidth: 120
  },
  {
    field: 'status',
    headerName: 'Status',
    minWidth: 120
  },
  {
    field: 'pdf_url',
    headerName: 'Download',
    minWidth: 150,
    renderCell: (params) => (
      <a
        href={params.value}
        target='_blank'
        rel='noopener noreferrer'
        style={{ color: '#1976d2', textDecoration: 'underline' }}
      >
        <img src={downloadImg} alt='download' />
      </a>
    )
  }
]
