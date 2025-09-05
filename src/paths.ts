// src/paths.ts
export const paths = {
  root: '/',
  dashboard: '/dashboard',
  home: '/home',
  profile: {
    root: '/profile',
    detail: (id: string | number = ':id') => `/profile/${id}`
  },
  auth1: {
    login: '/login'
  },
  auth: {
    login: '/auth/login',
    logout: '/auth/logout'
  },
  page404: '/404'
}
