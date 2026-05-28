import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Localization from 'expo-localization'

import pt from './pt.json'
import en from './en.json'

export type AppLanguage = 'pt' | 'en'
export const SUPPORTED_LANGUAGES: AppLanguage[] = ['pt', 'en']
export const LANGUAGE_STORAGE_KEY = '@nutriai_language'

// Detecta o idioma padrão: preferência salva → idioma do dispositivo → PT
async function getInitialLanguage(): Promise<AppLanguage> {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (saved === 'pt' || saved === 'en') return saved

    const deviceLocale = Localization.getLocales()[0]?.languageCode ?? 'pt'
    return deviceLocale.startsWith('pt') ? 'pt' : 'en'
  } catch {
    return 'pt'
  }
}

export async function changeLanguage(lang: AppLanguage) {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
  await i18n.changeLanguage(lang)
}

export async function initI18n() {
  const lng = await getInitialLanguage()

  await i18n
    .use(initReactI18next)
    .init({
      resources: {
        pt: { translation: pt },
        en: { translation: en },
      },
      lng,
      fallbackLng: 'pt',
      interpolation: { escapeValue: false },
      compatibilityJSON: 'v4',
    })

  return lng
}

export default i18n
