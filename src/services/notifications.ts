/**
 * notifications.ts
 * Serviço de notificações push — expo-notifications ~0.28
 */

import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import i18n from '@/i18n/index'
import { useNotificationStore, type ReminderId } from '@store/notificationStore'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // SDK 54: shouldShowAlert foi substituído por shouldShowBanner + shouldShowList
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
})

// ─── PERMISSÕES ───────────────────────────────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('nutriai', {
        name:             'NutriAI',
        importance:       Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor:       '#C8F060',
      })
    }
    const { status: existing } = await Notifications.getPermissionsAsync()
    if (existing === 'granted') return true
    const { status } = await Notifications.requestPermissionsAsync()
    return status === 'granted'
  } catch {
    return false
  }
}

export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync()
  } catch {}
}

// ─── LEMBRETES DIÁRIOS ────────────────────────────────────────────────────
/**
 * Reagenda todos os lembretes conforme as preferências do usuário.
 * Mensagens vêm do i18n (PT/EN). Cada lembrete só é agendado se estiver ligado
 * e o master switch estiver ativo. Chamar sempre que as preferências mudarem.
 */
export async function scheduleDailyReminders(): Promise<void> {
  await cancelAllNotifications()

  const { enabled, reminders } = useNotificationStore.getState()
  if (!enabled) return // master switch desligado → nenhum lembrete

  const t = (key: string) => i18n.t(key)

  for (const r of reminders) {
    if (!r.enabled) continue
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t(`reminders.${r.id}_title`),
          body:  t(`reminders.${r.id}_body`),
          data:  { screen: r.screen },
        },
        trigger: { hour: r.hour, minute: 0, repeats: true } as Notifications.NotificationTriggerInput,
      })
    } catch {
      // Silencia erros por diferenças de API entre versões
    }
  }
}

// ─── NOTIFICAÇÃO IMEDIATA ─────────────────────────────────────────────────
export async function sendAchievementNotification(title: string, body: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    })
  } catch {}
}

// ─── LISTENER DE NAVEGAÇÃO ────────────────────────────────────────────────
export function addNotificationResponseListener(callback: (screen: string) => void) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const screen = response.notification.request.content.data?.screen as string
    if (screen) callback(screen)
  })
}
