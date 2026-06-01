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

/**
 * Resolve a mensagem de erro de uma exceção para texto amigável traduzido.
 * Trata o marcador TIMEOUT (de callEdgeFunction) e cai no fallback genérico.
 * Use em catch: Alert.alert(title, resolveErrorMessage(err))
 */
export function resolveErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  if (msg === 'TIMEOUT') return i18n.t('errors.timeout')
  if (!msg || msg === 'undefined') return i18n.t('errors.generic')
  return msg
}
