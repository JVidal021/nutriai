/**
 * sentry.ts — inicialização de crash reporting.
 *
 * Só ativa se EXPO_PUBLIC_SENTRY_DSN estiver definido (no eas.json / .env).
 * Sem DSN, vira no-op — o app funciona normalmente sem reportar nada.
 *
 * Para ativar:
 *   1. Crie um projeto em https://sentry.io (plano grátis)
 *   2. Copie o DSN (Settings → Projects → seu projeto → Client Keys)
 *   3. Adicione em eas.json (env de cada profile):
 *        "EXPO_PUBLIC_SENTRY_DSN": "https://...@...ingest.sentry.io/..."
 */
import * as Sentry from '@sentry/react-native'

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? ''

export const sentryEnabled = DSN.length > 0

export function initSentry() {
  if (!sentryEnabled) return
  Sentry.init({
    dsn: DSN,
    // Em produção, amostra 100% dos erros mas pouca performance (custo)
    tracesSampleRate: 0.2,
    // Não envia dados pessoais por padrão (LGPD-friendly)
    sendDefaultPii: false,
    // Ignora erros de rede comuns (não acionáveis)
    ignoreErrors: [
      'Network request failed',
      'TIMEOUT',
      'AbortError',
    ],
  })
}

/** Captura manual de exceção (usado pelo ErrorBoundary). No-op sem DSN. */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!sentryEnabled) return
  Sentry.captureException(error, context ? { extra: context } : undefined)
}
