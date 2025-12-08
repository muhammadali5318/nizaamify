export const parseApiErrors = (errors: Record<string, any>) => {
  if (!errors || typeof errors !== 'object') return []

  const allMessages: string[] = []

  Object.values(errors).forEach((value) => {
    if (Array.isArray(value)) {
      value.forEach((msg) => allMessages.push(msg))
    }
  })

  return allMessages
}
