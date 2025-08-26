// src/paths.ts
export const paths = {
  root: '/',
  dashboard: '/dashboard',
  home: '/home',
  profile: {
    root: '/profile',
    detail: (id: string | number = ':id') => `/profile/${id}`
  },
  page404: '/404'
}
