/**
 * analytics.ts — telemetria de produto via PostHog.
 *
 * Princípios:
 *  - Só ativa se EXPO_PUBLIC_POSTHOG_KEY estiver definido (senão é no-op total).
 *  - Respeita LGPD: só rastreia se o usuário consentiu (consentimento "analytics").
 *    Por padrão o opt-in é FALSE — nada é enviado até o usuário aceitar.
 *  - Nunca envia dado pessoal sensível (e-mail, nome) — só eventos e propriedades neutras.
 *
 * Para ativar:
 *   1. Crie um projeto grátis em https://posthog.com (plataforma React Native)
 *   2. Copie a Project API Key (phc_...) e o host (us ou eu)
 *   3. Adicione em eas.json (env de cada profile):
 *        "EXPO_PUBLIC_POSTHOG_KEY":  "phc_...",
 *        "EXPO_PUBLIC_POSTHOG_HOST": "https://us.i.posthog.com"
 */
import PostHog from 'posthog-react-native'

const KEY  = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? ''
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'

export const analyticsEnabled = KEY.length > 0

let client: PostHog | null = null
let consentGranted = false

/** Inicializa o PostHog. Chamado uma vez no boot do app. No-op sem key. */
export function initAnalytics() {
  if (!analyticsEnabled || client) return
  client = new PostHog(KEY, {
    host: HOST,
    // Não captura nada automaticamente até o consentimento (LGPD opt-in)
    defaultOptIn: false,
    // Reduz ruído: não rastreia cada tela automaticamente — só eventos que definimos
    captureAppLifecycleEvents: false,
  })
}

/**
 * Atualiza o estado de consentimento. Chamar quando o usuário aceita/recusa
 * o consentimento "analytics" (tela de privacidade / onboarding LGPD).
 */
export function setAnalyticsConsent(granted: boolean) {
  consentGranted = granted
  if (!client) return
  if (granted) client.optIn()
  else         client.optOut()
}

/** Identifica o usuário (sem PII — só o ID). No-op sem consentimento. */
export function identifyUser(userId: string) {
  if (!client || !consentGranted) return
  client.identify(userId)
}

/** Limpa a identidade ao deslogar. */
export function resetAnalytics() {
  if (!client) return
  client.reset()
}

/**
 * Registra um evento de produto.
 * @param event nome do evento (ex: 'diet_generated')
 * @param props propriedades neutras (sem dados pessoais)
 */
export function track(event: string, props?: Record<string, string | number | boolean>) {
  if (!client || !consentGranted) return
  client.capture(event, props)
}

// ─── Catálogo de eventos (nomes centralizados — evita typo) ────────────────
export const Events = {
  onboardingStarted:    'onboarding_started',
  onboardingCompleted:  'onboarding_completed',
  onboardingStepViewed: 'onboarding_step_viewed',
  dietGenerated:        'diet_generated',
  workoutGenerated:     'workout_generated',
  mealScanned:          'meal_scanned',
  coachMessageSent:     'coach_message_sent',
  checkinDone:          'checkin_done',
  subscriptionViewed:   'subscription_viewed',
  checkoutStarted:      'checkout_started',
  promoRedeemed:        'promo_redeemed',
} as const
