/**
 * notifications.ts
 * Serviço de notificações push — expo-notifications ~0.28
 */

import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
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
export async function scheduleDailyReminders(): Promise<void> {
  await cancelAllNotifications()

  const reminders = [
    { hour: 8,  title: 'Bom dia! ☀️',         body: 'Já registrou o café da manhã? Fotografe e ganhe +15 XP!',    screen: 'scan' },
    { hour: 12, title: 'Hora do almoço 📸',    body: 'Fotografe seu prato e deixe a IA calcular as calorias.',     screen: 'scan' },
    { hour: 19, title: 'Check-in do dia 🌿',   body: 'Como você está? Registre o humor e otimize seu treino.',     screen: 'home' },
    { hour: 21, title: 'Não perca o streak! 🔥', body: 'Você ainda não registrou nada hoje. Mantenha o streak!', screen: 'home' },
  ]

  for (const r of reminders) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title: r.title, body: r.body, data: { screen: r.screen } },
        trigger:  { hour: r.hour, minute: 0, repeats: true } as Notifications.NotificationTriggerInput,
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
