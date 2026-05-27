import { RANKS } from '@constants/index'
import type { Gender, Goal, Profile, ActivityLevel, FitnessLevel, Rank, User } from '@types/index'

// ─── DB ↔ APP MAPPERS ────────────────────────────────────────────────────
// O banco retorna snake_case; o tipo User usa camelCase.
// Use dbUserToUser ao ler do Supabase, userToDbFields ao escrever.

export function dbUserToUser(raw: Record<string, unknown>): User {
  return {
    id:            raw.id            as string,
    name:          raw.name          as string,
    email:         raw.email         as string,
    gender:        (raw.gender        as Gender)        ?? 'neu',
    goal:          (raw.goal          as Goal)           ?? 'maintain',
    profile:       (raw.profile       as Profile)        ?? 'escultura',
    activityLevel: (raw.activity_level as ActivityLevel) ?? 'moderate',
    fitnessLevel:  (raw.fitness_level  as FitnessLevel)  ?? 'beginner',
    height:        (raw.height        as number)         ?? 170,
    weight:        (raw.weight        as number)         ?? 70,
    targetWeight:  (raw.target_weight as number)         ?? 70,
    age:           (raw.age           as number)         ?? 25,
    restrictions:  (raw.restrictions  as string[])       ?? [],
    isPremium:        (raw.is_premium         as boolean)        ?? false,
    createdAt:        (raw.created_at         as string)         ?? new Date().toISOString(),
    premiumExpiresAt: (raw.premium_expires_at as string)         ?? undefined,
    premiumPlan:      (raw.premium_plan       as 'monthly' | 'annual' | 'trial') ?? undefined,
    subscriptionType: (raw.subscription_type  as 'recurring' | 'one_time' | 'trial') ?? undefined,
    promoCodeUsed:    (raw.promo_code_used    as string) ?? undefined,
    mpSubscriptionId: (raw.mp_subscription_id as string)         ?? undefined,
    foodBudget:       (raw.food_budget   as 'economico' | 'moderado' | 'premium') ?? undefined,
    foodLikes:        (raw.food_likes    as string) ?? undefined,
    foodDislikes:     (raw.food_dislikes as string) ?? undefined,
    cookingTime:      (raw.cooking_time  as 'rapido' | 'moderado' | 'elaborado')  ?? undefined,
  }
}

export function userToDbFields(u: User): Record<string, unknown> {
  return {
    id:             u.id,
    name:           u.name,
    email:          u.email,
    gender:         u.gender,
    goal:           u.goal,
    profile:        u.profile,
    activity_level: u.activityLevel,
    fitness_level:  u.fitnessLevel,
    height:         u.height,
    weight:         u.weight,
    target_weight:  u.targetWeight,
    age:            u.age,
    restrictions:   u.restrictions,
    is_premium:         u.isPremium,
    premium_expires_at: u.premiumExpiresAt,
    premium_plan:       u.premiumPlan,
    subscription_type:  u.subscriptionType,
    mp_subscription_id: u.mpSubscriptionId,
    promo_code_used:    u.promoCodeUsed,
    food_budget:        u.foodBudget,
    food_likes:         u.foodLikes,
    food_dislikes:      u.foodDislikes,
    cooking_time:       u.cookingTime,
  }
}

// ─── RANK ─────────────────────────────────────────────────────────────────
export function getRankFromXp(xp: number): Rank {
  return RANKS.findLast((r) => xp >= r.minXp) ?? RANKS[0]
}

export function getXpToNextRank(xp: number): { needed: number; percent: number; next: Rank | null } {
  const currentIdx = RANKS.findLastIndex((r) => xp >= r.minXp)
  const next = RANKS[currentIdx + 1] ?? null
  if (!next) return { needed: 0, percent: 100, next: null }
  const current = RANKS[currentIdx]
  const needed = next.minXp - xp
  const percent = ((xp - current.minXp) / (next.minXp - current.minXp)) * 100
  return { needed, percent: Math.min(percent, 100), next }
}

// ─── GENDER-AWARE TEXT ────────────────────────────────────────────────────
type GenderText = { masc: string; fem: string; neu: string }

export function gText(gender: Gender, texts: GenderText): string {
  if (gender === 'skip') return texts.neu
  return texts[gender] ?? texts.neu
}

// Exemplos de uso:
// gText(gender, { masc: 'bem-vindo', fem: 'bem-vinda', neu: 'bem-vinde' })
// gText(gender, { masc: 'cansado', fem: 'cansada', neu: 'cansade' })
// gText(gender, { masc: 'ativo', fem: 'ativa', neu: 'ative' })

// ─── NUTRITION MATH ──────────────────────────────────────────────────────
export function calcTMB(weight: number, height: number, age: number, gender: Gender): number {
  // Fórmula Mifflin-St Jeor
  const base = 10 * weight + 6.25 * height - 5 * age
  if (gender === 'fem') return Math.round(base - 161)
  return Math.round(base + 5) // masc / neu / skip
}

export function calcTDEE(tmb: number, activityLevel: string): number {
  const multipliers: Record<string, number> = {
    sedentary: 1.2,
    light:     1.375,
    moderate:  1.55,
    active:    1.725,
  }
  return Math.round(tmb * (multipliers[activityLevel] ?? 1.55))
}

export function calcTargetCalories(tdee: number, goal: string): number {
  const adjustments: Record<string, number> = {
    lose_weight:  -500,
    gain_muscle:  +300,
    maintain:     0,
    performance:  +200,
  }
  return tdee + (adjustments[goal] ?? 0)
}

export function calcBMI(weight: number, heightCm: number): number {
  return parseFloat((weight / (heightCm / 100) ** 2).toFixed(1))
}

export function getBMICategory(bmi: number): string {
  if (bmi < 18.5) return 'Abaixo do peso'
  if (bmi < 25)   return 'Peso normal'
  if (bmi < 30)   return 'Sobrepeso'
  return 'Obesidade'
}

export function weeksToGoal(currentWeight: number, targetWeight: number, weeklyRateKg = 0.4): number {
  const diff = Math.abs(currentWeight - targetWeight)
  return Math.ceil(diff / weeklyRateKg)
}

// ─── EFFICIENCY SCORE ────────────────────────────────────────────────────
export function calcEfficiencyScore(params: {
  adherencePercent: number
  streak: number
  avgSleepHours: number
  avgHydrationLiters: number
}): number {
  const { adherencePercent, streak, avgSleepHours, avgHydrationLiters } = params
  const adherenceScore   = (adherencePercent / 100) * 40   // peso 40
  const streakScore      = Math.min(streak / 30, 1) * 25   // peso 25
  const sleepScore       = (Math.min(avgSleepHours, 8) / 8) * 20  // peso 20
  const hydrationScore   = (Math.min(avgHydrationLiters, 2.5) / 2.5) * 15 // peso 15
  return Math.round(adherenceScore + streakScore + sleepScore + hydrationScore)
}

// ─── FORMATTERS ──────────────────────────────────────────────────────────
export function formatCalories(kcal: number): string {
  return kcal.toLocaleString('pt-BR')
}

export function formatWeight(kg: number): string {
  return `${kg.toFixed(1)} kg`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function getGreeting(gender: Gender, name: string): string {
  const hour = new Date().getHours()
  const period = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const firstName = name?.split(' ')[0] ?? ''
  return `${period}${firstName ? `, ${firstName}` : ''} 👋`
}

export function getMoodAdaptationMessage(gender: Gender, mood: string): string {
  const isMood = (m: string) => mood === m
  if (isMood('tired') || isMood('exhausted')) {
    return gText(gender, {
      masc: 'Treino adaptado para você, que está cansado hoje. Cuide-se! 💚',
      fem:  'Treino adaptado para você, que está cansada hoje. Cuide-se! 💚',
      neu:  'Treino adaptado para você, que está cansade hoje. Cuide-se! 💚',
    })
  }
  return gText(gender, {
    masc: 'Ótimo! Plano mantido. Você está pronto para o dia! 🔥',
    fem:  'Ótimo! Plano mantido. Você está pronta para o dia! 🔥',
    neu:  'Ótimo! Plano mantido. Você está pronte para o dia! 🔥',
  })
}

// ─── COOP CODE GENERATOR ─────────────────────────────────────────────────
export function generateCoopCode(name: string): string {
  const prefix = 'NUT'
  const initial = (name ?? '?').charAt(0).toUpperCase()
  const num = Math.floor(Math.random() * 90) + 10
  return `${prefix}-${initial}${num}`
}
