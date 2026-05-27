import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type {
  User, Meal, WorkoutSession, DailyCheckin,
  ChatMessage, CoopSession, MetabolicProfile,
  DailyDietPlan, UserProgress, MoodType,
  PlannedMeal, WeeklyFeedback, PlanContext,
} from '@/types/index'
import { RANKS, XP_VALUES, MOODS } from '@constants/index'

// ─── ESTADO INICIAL — zeros reais para novos usuários ─────────────────────
const INITIAL_PROGRESS: UserProgress = {
  totalXp:            0,
  rank:               RANKS[0], // Bronze I
  streak:             0,
  longestStreak:      0,
  activeDays:         0,
  adherencePercent:   0,
  weightLost:         0,
  workoutsCompleted:  0,
  mealsLogged:        0,
}

// ─── USER STORE ───────────────────────────────────────────────────────────
interface UserState {
  user: User | null
  isOnboarded: boolean
  isLoading: boolean
  setUser: (user: User) => void
  updateUser: (partial: Partial<User>) => void
  completeOnboarding: (user: User) => void
  setLoading: (v: boolean) => void
  clearUser: () => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user:        null,
      isOnboarded: false,
      isLoading:   true, // true até a sessão ser verificada no _layout
      setUser:     (user) => set({ user }),
      updateUser:  (partial) =>
        set((s) => ({ user: s.user ? { ...s.user, ...partial } : null })),
      completeOnboarding: (user) => set({ user, isOnboarded: true }),
      setLoading:  (isLoading) => set({ isLoading }),
      clearUser:   () => set({ user: null, isOnboarded: false, isLoading: false }),
    }),
    {
      name: 'nutriai-user',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ user: s.user, isOnboarded: s.isOnboarded }),
    }
  )
)

// ─── NUTRITION STORE ──────────────────────────────────────────────────────
interface NutritionState {
  todayMeals:     Meal[]
  weekPlan:       DailyDietPlan[]
  weeklyFeedback: WeeklyFeedback | null
  addMeal:             (meal: Meal) => void
  removeMeal:          (mealId: string) => void
  setWeekPlan:         (plan: DailyDietPlan[]) => void
  markMealCompleted:   (date: string, mealType: string) => void
  swapMeal:            (date: string, mealType: string, newMeal: PlannedMeal) => void
  getTodayTotals:      () => { calories: number; protein: number; carbs: number; fat: number }
  resetDayMeals:       () => void
  setWeeklyFeedback:   (fb: WeeklyFeedback | null) => void
}

export const useNutritionStore = create<NutritionState>()(
  persist(
    (set, get) => ({
      todayMeals:     [],
      weekPlan:       [],
      weeklyFeedback: null,

      addMeal: (meal) => set((s) => {
        // BUG 11 FIX: descartar refeições de dias anteriores ao adicionar nova
        const today = new Date().toISOString().split('T')[0]
        const cleaned = s.todayMeals.filter((m) => m.loggedAt.startsWith(today))
        return { todayMeals: [...cleaned, meal] }
      }),

      removeMeal: (mealId) =>
        set((s) => ({ todayMeals: s.todayMeals.filter((m) => m.id !== mealId) })),

      setWeekPlan: (plan) => set({ weekPlan: plan }),

      markMealCompleted: (date, mealType) =>
        set((s) => ({
          weekPlan: s.weekPlan.map((day) =>
            day.date !== date ? day : {
              ...day,
              meals: day.meals.map((m) =>
                m.type === mealType ? { ...m, completed: true } : m
              ),
            }
          ),
        })),

      getTodayTotals: () => {
        const today = new Date().toISOString().split('T')[0]
        const meals = get().todayMeals.filter((m) =>
          m.loggedAt.startsWith(today)
        )
        return meals.reduce(
          (acc, meal) => ({
            calories: acc.calories + (meal.totalMacros?.calories ?? 0),
            protein:  acc.protein  + (meal.totalMacros?.protein  ?? 0),
            carbs:    acc.carbs    + (meal.totalMacros?.carbs    ?? 0),
            fat:      acc.fat      + (meal.totalMacros?.fat      ?? 0),
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        )
      },

      resetDayMeals: () => set({ todayMeals: [] }),

      swapMeal: (date, mealType, newMeal) =>
        set((s) => ({
          weekPlan: s.weekPlan.map((day) =>
            day.date !== date ? day : {
              ...day,
              meals: day.meals.map((m) =>
                m.type !== mealType ? m : { ...newMeal, completed: false }
              ),
            }
          ),
        })),

      setWeeklyFeedback: (weeklyFeedback) => set({ weeklyFeedback }),
    }),
    { name: 'nutriai-nutrition', storage: createJSONStorage(() => AsyncStorage) }
  )
)

// ─── WORKOUT STORE ────────────────────────────────────────────────────────
interface WorkoutState {
  weekWorkouts: WorkoutSession[]
  setWeekWorkouts:  (workouts: WorkoutSession[]) => void
  completeSet:      (workoutId: string, blockId: string, exerciseId: string) => void
  completeWorkout:  (workoutId: string) => void
  getTodayWorkout:  () => WorkoutSession | undefined
  swapWorkoutDay:   (date: string, newWorkout: WorkoutSession) => void
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      weekWorkouts: [],

      setWeekWorkouts: (workouts) => set({ weekWorkouts: workouts }),

      completeSet: (workoutId, blockId, exerciseId) =>
        set((s) => ({
          weekWorkouts: s.weekWorkouts.map((w) =>
            w.id !== workoutId ? w : {
              ...w,
              blocks: w.blocks.map((b) =>
                b.id !== blockId ? b : {
                  ...b,
                  exercises: b.exercises?.map((e) =>
                    e.id !== exerciseId ? e : {
                      ...e,
                      completedSets: Math.min(e.completedSets + 1, e.sets),
                    }
                  ),
                }
              ),
            }
          ),
        })),

      completeWorkout: (workoutId) =>
        set((s) => ({
          weekWorkouts: s.weekWorkouts.map((w) =>
            w.id === workoutId
              ? { ...w, completed: true, completedAt: new Date().toISOString() }
              : w
          ),
        })),

      getTodayWorkout: () => {
        const today = new Date().toISOString().split('T')[0]
        return get().weekWorkouts.find((w) => w.date === today && !w.completed)
      },

      swapWorkoutDay: (date, newWorkout) =>
        set((s) => ({
          weekWorkouts: s.weekWorkouts.map((w) =>
            w.date !== date ? w : newWorkout
          ),
        })),
    }),
    { name: 'nutriai-workout', storage: createJSONStorage(() => AsyncStorage) }
  )
)

// ─── PROGRESS STORE ───────────────────────────────────────────────────────
interface ProgressState {
  progress:       UserProgress
  xpHistory:      Array<{ type: string; xp: number; date: string }>
  checkins:       DailyCheckin[]
  lastActiveDate: string | null  // BUG 7 FIX: rastreia último dia com atividade
  addXp:           (type: keyof typeof XP_VALUES, bonusMultiplier?: number) => void
  logCheckin:      (mood: MoodType, emoji: string, userId: string) => DailyCheckin  // BUG 8 FIX
  getTodayCheckin: () => DailyCheckin | undefined
  getRankProgress: () => { current: (typeof RANKS)[number]; next: (typeof RANKS)[number] | null; percent: number }
  resetProgress:   () => void
}

// Tipos de XP que contam como "dia ativo" para o streak
const STREAK_XP_TYPES = new Set<keyof typeof XP_VALUES>(['MEAL_LOGGED', 'WORKOUT_DONE', 'CHECKIN_DONE'])

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      progress:       INITIAL_PROGRESS,
      xpHistory:      [],
      checkins:       [],
      lastActiveDate: null,

      // BUG 6+7 FIX: incrementa contadores específicos e atualiza streak
      addXp: (type, bonusMultiplier = 1) => {
        const base    = XP_VALUES[type]
        const earned  = Math.round(base * bonusMultiplier)
        const todayStr = new Date().toISOString().split('T')[0]
        const todayIso = new Date().toISOString()

        set((s) => {
          const newXp   = s.progress.totalXp + earned
          const newRank = [...RANKS].reverse().find((r) => newXp >= r.minXp) ?? RANKS[0]

          // Incrementar contadores específicos por tipo de XP
          const counters: Partial<UserProgress> = {}
          if (type === 'MEAL_LOGGED')  counters.mealsLogged       = s.progress.mealsLogged + 1
          if (type === 'WORKOUT_DONE') counters.workoutsCompleted = s.progress.workoutsCompleted + 1

          // Atualizar streak se for o primeiro evento do dia
          let newStreak       = s.progress.streak
          let newLongestStreak = s.progress.longestStreak
          let newActiveDays   = s.progress.activeDays
          let newLastActive   = s.lastActiveDate

          if (STREAK_XP_TYPES.has(type) && s.lastActiveDate !== todayStr) {
            // Verificar se ontem foi o último dia ativo (streak consecutivo)
            const yesterday = new Date()
            yesterday.setDate(yesterday.getDate() - 1)
            const yesterdayStr = yesterday.toISOString().split('T')[0]

            if (s.lastActiveDate === yesterdayStr) {
              newStreak = s.progress.streak + 1
            } else {
              // Intervalo rompeu o streak — começa do 1
              newStreak = 1
            }
            newLongestStreak = Math.max(newStreak, s.progress.longestStreak)
            newActiveDays    = s.progress.activeDays + 1
            newLastActive    = todayStr
          }

          return {
            progress: {
              ...s.progress,
              totalXp:          newXp,
              rank:             newRank,
              streak:           newStreak,
              longestStreak:    newLongestStreak,
              activeDays:       newActiveDays,
              ...counters,
            },
            xpHistory:      [...s.xpHistory, { type, xp: earned, date: todayIso }],
            lastActiveDate: newLastActive,
          }
        })
      },

      // BUG 8 FIX: aceita userId real em vez de usar string vazia
      logCheckin: (mood, emoji, userId) => {
        const moodData = MOODS.find((m) => m.id === mood) ?? MOODS[1]
        const checkin: DailyCheckin = {
          id:        Date.now().toString(),
          userId,
          mood,
          moodEmoji: emoji,
          date:      new Date().toISOString().split('T')[0],
          adaptations: {
            workoutAdjusted:  moodData.workoutIntensity < 1,
            caloriesAdjusted: moodData.calorieAdjust,
            message: moodData.workoutIntensity < 1
              ? `Treino adaptado para intensidade leve. Meta calórica ajustada em ${moodData.calorieAdjust} kcal.`
              : 'Plano mantido. Boa energia hoje! 🔥',
          },
        }
        set((s) => ({ checkins: [...s.checkins, checkin] }))
        return checkin
      },

      getTodayCheckin: () => {
        const today = new Date().toISOString().split('T')[0]
        return [...get().checkins].reverse().find((c) => c.date === today)
      },

      getRankProgress: () => {
        const { totalXp } = get().progress
        const currentIdx  = [...RANKS].map((r, i) => ({ r, i }))
          .filter(({ r }) => totalXp >= r.minXp)
          .pop()?.i ?? 0
        const current = RANKS[currentIdx]
        const next    = RANKS[currentIdx + 1] ?? null
        const percent = next
          ? Math.min(((totalXp - current.minXp) / (next.minXp - current.minXp)) * 100, 100)
          : 100
        return { current, next, percent }
      },

      resetProgress: () => set({
        progress:       INITIAL_PROGRESS,
        xpHistory:      [],
        checkins:       [],
        lastActiveDate: null,
      }),
    }),
    { name: 'nutriai-progress', storage: createJSONStorage(() => AsyncStorage) }
  )
)

// ─── COACH STORE ──────────────────────────────────────────────────────────
interface CoachState {
  messages:       ChatMessage[]
  isTyping:       boolean
  planContext:    PlanContext | null
  addMessage:     (msg: ChatMessage) => void
  setTyping:      (v: boolean) => void
  clearHistory:   () => void
  setPlanContext: (ctx: PlanContext | null) => void
}

export const useCoachStore = create<CoachState>()((set) => ({
  messages: [
    {
      id:        '0',
      role:      'assistant',
      content:   'Olá! 🌿 Estou aqui para ajudar com nutrição, treinos e saúde. Como posso ajudar hoje?',
      timestamp: new Date().toISOString(),
    },
  ],
  isTyping:       false,
  planContext:    null,
  addMessage:     (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setTyping:      (isTyping) => set({ isTyping }),
  clearHistory:   () => set({ messages: [] }),
  setPlanContext: (planContext) => set({ planContext }),
}))

// ─── COOP STORE ───────────────────────────────────────────────────────────
interface CoopState {
  session: CoopSession | null
  setSession: (s: CoopSession | null) => void
}

export const useCoopStore = create<CoopState>()(
  persist(
    (set) => ({
      session:    null,
      setSession: (session) => set({ session }),
    }),
    { name: 'nutriai-coop', storage: createJSONStorage(() => AsyncStorage) }
  )
)

// ─── METABOLIC STORE ──────────────────────────────────────────────────────
interface MetabolicState {
  profile:    MetabolicProfile | null
  setProfile: (p: MetabolicProfile) => void
}

export const useMetabolicStore = create<MetabolicState>()(
  persist(
    (set) => ({
      profile:    null,
      setProfile: (profile) => set({ profile }),
    }),
    { name: 'nutriai-metabolic', storage: createJSONStorage(() => AsyncStorage) }
  )
)
