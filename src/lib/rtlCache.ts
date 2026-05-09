import createCache, { type EmotionCache } from '@emotion/cache'
import rtlPlugin from 'stylis-plugin-rtl'

let ltrCache: EmotionCache | null = null
let rtlCache: EmotionCache | null = null

export function getEmotionCache(direction: 'ltr' | 'rtl'): EmotionCache {
  if (direction === 'rtl') {
    if (!rtlCache) {
      rtlCache = createCache({
        key: 'mui-rtl',
        stylisPlugins: [rtlPlugin],
        prepend: true
      })
    }
    return rtlCache
  }

  if (!ltrCache) {
    ltrCache = createCache({ key: 'mui', prepend: true })
  }
  return ltrCache
}
