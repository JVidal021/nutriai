/**
 * dailyStore.ts
 * Estado diário: hidratação e estatísticas do dia.
 * Reseta automaticamente à meia-noite.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

const TODAY = () => new Date().toISOString().split('T')[0]

interface DailyState {
  date:         string   // YYYY-MM-DD do último reset
  hydrationMl:  number   // ml bebidos hoje
  stepsCount:   number   // passos hoje (manual por enquanto)

  // Ações
  addHydration: (ml: number) => void
  setSteps:     (steps: number) => void
  resetIfNewDay:() => void

  // Computed
  getHydrationPercent: () => number // % da meta de 2000ml
}

export const useDailyStore = create<DailyState>()(
  persist(
    (set, get) => ({
      date:        TODAY(),
      hydrationMl: 0,
      stepsCount:  0,

      addHydration: (ml) => {
        get().resetIfNewDay()
        set((s) => ({ hydrationMl: Math.min(s.hydrationMl + ml, 5000) }))
      },

      setSteps: (steps) => {
        get().resetIfNewDay()
        set({ stepsCount: steps })
      },

      resetIfNewDay: () => {
        const today = TODAY()
        if (get().date !== today) {
          set({ date: today, hydrationMl: 0, stepsCount: 0 })
        }
      },

      getHydrationPercent: () => {
        const TARGET = 2000
        return Math.min((get().hydrationMl / TARGET) * 100, 100)
      },
    }),
    { name: 'nutriai-daily', storage: createJSONStorage(() => AsyncStorage) }
  )
)
