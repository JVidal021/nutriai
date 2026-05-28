import { useTranslation } from 'react-i18next'
import type { AppLanguage } from './index'
import i18n, { changeLanguage } from './index'

/** Hook principal — idêntico ao useTranslation() do react-i18next */
export function useT() {
  return useTranslation()
}

/** Idioma atual sem precisar do hook */
export function getCurrentLanguage(): AppLanguage {
  return (i18n.language ?? 'pt') as AppLanguage
}

/** Trocar idioma de qualquer lugar (fora de componente) */
export { changeLanguage }
