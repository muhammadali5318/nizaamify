import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from 'src/locales/en'
import ur from 'src/locales/ur'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en, ur },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ur'],
    defaultNS: 'common',
    ns: [
      'common',
      'auth',
      'onboarding',
      'subscription',
      'pos',
      'products',
      'customers',
      'khata',
      'purchases',
      'expenses',
      'targets',
      'reports',
      'settings',
      'sales',
      'suppliers',
      'units',
      'tiers',
      'variant_attributes'
    ],
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'lng'
    },
    interpolation: { escapeValue: false }
  })

export function getDirection(lng: string): 'ltr' | 'rtl' {
  return lng === 'ur' ? 'rtl' : 'ltr'
}

export function applyHtmlLangDir(lng: string): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = lng
  document.documentElement.dir = getDirection(lng)
}

applyHtmlLangDir(i18n.language || 'en')
i18n.on('languageChanged', applyHtmlLangDir)

export default i18n
