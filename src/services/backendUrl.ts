const apiVersion = 'v1'
export const endpoints = {
  userInfo: apiVersion,
  signup: {
    createUser: `user-workstation/${apiVersion}/users/signup/`,
    verifyEmail: `user-workstation/${apiVersion}/users/verify-email/`
  }
}
