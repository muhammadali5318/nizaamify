// Use this axios instance to call apis with configurations like baseURL

import axios from 'axios'
import { CONFIG } from 'src/config-global'

// ----------------------------------------------------------------------

const errorCallback = (error: {
  code: string
  response: { data?: any; status?: any }
}) => {
  if (error.code === 'ERR_NETWORK') {
    console.error(
      'We are experiencing technical difficulties. This may be due to network issues or a CORS error. Please try again later.'
    )
  } else if (error.response) {
    const { status } = error.response

    switch (status) {
      case 401:
        console.error('Unauthorized. Please log in.')
        break
      case 403:
        console.error('Forbidden. You do not have access.')
        break
      case 404:
        console.error('Resource not found.')
        break
      case 500:
        console.error('Internal Server error')
        break
      default:
        console.error('An unexpected error occurred.')
        break
    }
  } else {
    console.error('Network error. Please check your connection.')
  }

  throw (
    (error.response && error.response.data) ||
    new Error('Something went wrong!')
  )
}

const apiClient = axios.create({
  baseURL: CONFIG.serverUrl,
  headers: {
    'Content-Type': 'application/json' // Optional: Default headers
  }
})

apiClient.interceptors.response.use((response) => response, errorCallback)

export default apiClient
