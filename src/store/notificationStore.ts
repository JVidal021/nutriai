/**
 * notificationStore.ts
 * Preferências de lembretes diários, persistidas localmente.
 * Cada lembrete pode ser ligado/desligado e ter o horário ajustado.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type ReminderId = 'breakfast' | 'lunch' | 'checkin' | 'streak'

export interface Reminder {
  id:      ReminderId
  enabled: boolean
  hour:    number   // 0-23
  screen:  'scan' | 'home'
}

interface NotificationState {
  // Master switch — desliga todos os lembretes de uma vez
  enabled:   boolean
  reminders: Reminder[]

  setEnabled:        (on: boolean) => void
  toggleReminder:    (id: ReminderId) => void
  setReminderHour:   (id: ReminderId, hour: number) => void
}

// Padrões — mesmos horários que já existiam fixos no código
const DEFAULT_REMINDERS: Reminder[] = [
  { id: 'breakfast', enabled: true, hour: 8,  screen: 'scan' },
  { id: 'lunch',     enabled: true, hour: 12, screen: 'scan' },
  { id: 'checkin',   enabled: true, hour: 19, screen: 'home' },
  { id: 'streak',    enabled: true, hour: 21, screen: 'home' },
]

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      enabled:   true,
      reminders: DEFAULT_REMINDERS,

      setEnabled: (on) => set({ enabled: on }),

      toggleReminder: (id) =>
        set((s) => ({
          reminders: s.reminders.map((r) =>
            r.id === id ? { ...r, enabled: !r.enabled } : r
          ),
        })),

      setReminderHour: (id, hour) =>
        set((s) => ({
          reminders: s.reminders.map((r) =>
            r.id === id ? { ...r, hour } : r
          ),
        })),
    }),
    {
      name: 'nutriai-notifications',
      storage: createJSONStorage(() => AsyncStorage),
      // Migração: se a estrutura mudar no futuro, garante defaults
      merge: (persisted, current) => {
        const p = persisted as Partial<NotificationState> | undefined
        if (!p?.reminders || p.reminders.length !== DEFAULT_REMINDERS.length) {
          return { ...current, ...p, reminders: DEFAULT_REMINDERS }
        }
        return { ...current, ...p }
      },
    }
  )
)
