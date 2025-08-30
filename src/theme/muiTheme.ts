// src/theme/muiTheme.ts
import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: 'none' as const
        }
      }
    },

    MuiTextField: {
      styleOverrides: {
        root: {
          borderRadius: 12
        }
      }
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12
        },
        notchedOutline: {
          borderRadius: 12
        },
        input: {
          borderRadius: 12
        }
      }
    },

    MuiInputBase: {
      styleOverrides: {
        root: {
          borderRadius: 12
        }
      }
    },

    MuiSelect: {
      styleOverrides: {
        outlined: {
          borderRadius: 12
        }
      }
    },

    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 12
        }
      }
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12
        }
      }
    }
  }
})

export default theme
