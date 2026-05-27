// ─── USER ───────────────────────────────────────────────────────────────
export type Gender = 'masc' | 'fem' | 'neu' | 'skip'
export type Goal = 'lose_weight' | 'gain_muscle' | 'maintain' | 'performance'
export type Profile = 'escultura' | 'vitalidade' | 'harmonia'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active'
export type FitnessLevel  = 'beginner' | 'intermediate' | 'advanced'

export interface User {
  id: string
  name: string
  email: string
  gender: Gender
  goal: Goal
  profile: Profile
  activityLevel: ActivityLevel
  fitnessLevel:  FitnessLevel   // experiência na academia
  height: number       // cm
  weight: number       // kg
  targetWeight: number // kg
  age: number
  restrictions: string[]
  isPremium: boolean
  createdAt: string
  // Premium / assinatura
  premiumExpiresAt?:  string                          // ISO date — quando o acesso expira
  premiumPlan?:       'monthly' | 'annual' | 'trial'  // plano ativo
  subscriptionType?:  'recurring' | 'one_time' | 'trial' // tipo de cobrança
  promoCodeUsed?:     string                          // código de convite resgatado
  mpSubscriptionId?:  string             // preapproval_id para planos recorrentes
  // Preferências alimentares
  foodBudget?:    'economico' | 'moderado' | 'premium'
  foodLikes?:     string      // alimentos que gosta / costuma comer
  foodDislikes?:  string      // alimentos que evita / não gosta
  cookingTime?:   'rapido' | 'moderado' | 'elaborado'
}

// ─── NUTRITION ───────────────────────────────────────────────────────────
export interface Macros {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
}

export interface FoodItem {
  id: string
  name: string
  quantity: number     // grams
  unit?: string
  macros: Macros
  emoji?: string
}

export interface Meal {
  id: string
  userId: string
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  foods: FoodItem[]
  totalMacros: Macros
  photoUrl?: string
  aiConfidence?: number
  loggedAt: string
}

export interface DailyDietPlan {
  date: string
  targetMacros: Macros
  meals: PlannedMeal[]
  adjustedCalories?: number
  adjustmentReason?: string
}

export interface PlannedMeal {
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  foods: FoodItem[]
  totalMacros: Macros
  completed: boolean
}

// ─── SCAN RESULT ─────────────────────────────────────────────────────────
export interface ScanResult {
  foods: Array<{
    name: string
    quantity_g: number
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }>
  total: Macros
  confidence: number
  notes: string
}

// ─── WORKOUT ─────────────────────────────────────────────────────────────
export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps'
  | 'legs' | 'glutes' | 'core' | 'cardio' | 'mobility'

export interface Exercise {
  id: string
  name: string
  muscleGroup: MuscleGroup
  sets: number
  reps: string         // e.g. "8-10" or "até falha"
  weight?: number      // kg
  durationMin?: number
  completedSets: number
  notes?: string
  tip?: string         // como executar o exercício (gerado pela IA)
  searchName?: string  // nome em inglês para busca no ExerciseDB
  bodyPart?: string    // grupo muscular em inglês (chest, back, shoulders…)
}

export type BlockType = 'warmup' | 'main' | 'cardio' | 'cooldown'
export type BlockStatus = 'fixed' | 'adapted' | 'ai_added' | 'locked'

export interface WorkoutBlock {
  id: string
  type: BlockType
  status: BlockStatus
  title: string
  durationMin: number
  exercises?: Exercise[]
  originalTitle?: string  // shown if adapted
}

export interface WorkoutSession {
  id: string
  date: string
  title: string
  muscleGroups: MuscleGroup[]
  blocks: WorkoutBlock[]
  estimatedCalories: number
  estimatedDuration: number
  completed: boolean
  completedAt?: string
  xpEarned?: number
}

// ─── GAMIFICATION ────────────────────────────────────────────────────────
export type RankTier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'legendary'
export type RankLevel = 1 | 2 | 3

export interface Rank {
  tier: RankTier
  level: RankLevel
  emoji: string
  label: string
  minXp: number
  maxXp: number
}

export interface XpEvent {
  id: string
  type: 'meal_logged' | 'workout_done' | 'goal_met' | 'streak_bonus' | 'coop_challenge'
  xp: number
  description: string
  earnedAt: string
}

export interface UserProgress {
  totalXp: number
  rank: Rank
  streak: number
  longestStreak: number
  activeDays: number
  adherencePercent: number
  weightLost: number
  workoutsCompleted: number
  mealsLogged: number
}

// ─── CO-OP ────────────────────────────────────────────────────────────────
export interface CoopPartner {
  id: string
  name: string
  avatarInitial: string
  isOnline: boolean
  todayCaloriesPercent: number
  todayWorkoutDone: boolean
  rank: Rank
}

export interface CoopChallenge {
  id: string
  title: string
  description: string
  totalDays: number
  completedDays: number
  xpReward: number
  rewardDescription: string
  active: boolean
}

export interface CoopSession {
  partnerId: string
  partner: CoopPartner
  coopCode: string
  daysTogetherCount: number
  challengesCompleted: number
  coopStreak: number
  syncedMenu: {
    dinner: {
      user: string
      partner: string
    }
  }
}

// ─── OPTIMIZATION ────────────────────────────────────────────────────────
export interface MetabolicPattern {
  id: string
  type: 'positive' | 'warning' | 'neutral'
  title: string
  description: string
  color: string
}

export interface WeightDataPoint {
  date: string
  weight: number
  isProjection: boolean
}

export interface MetabolicProfile {
  efficiencyScore: number        // 0–100
  weeklyRatioKg: number          // e.g. -0.4
  avgCaloriesBurntPerWorkout: number
  adherencePercent: number
  daysToGoal: number
  weightHistory: WeightDataPoint[]
  patterns: MetabolicPattern[]
  scenarioBonus?: {
    extraWorkoutsPerWeek: number
    weeksReduced: number
    newEfficiency: number
  }
}

// ─── CHECK-IN ────────────────────────────────────────────────────────────
export type MoodType = 'great' | 'good' | 'neutral' | 'tired' | 'exhausted'

export interface DailyCheckin {
  id: string
  userId: string
  mood: MoodType
  moodEmoji: string
  date: string
  adaptations?: {
    workoutAdjusted: boolean
    caloriesAdjusted: number
    message: string
  }
}

// ─── CHAT ────────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

// ─── PLAN INTERACTION ────────────────────────────────────────────────────
export interface WeeklyFeedback {
  whatWorked:    string
  whatDidnt:     string
  wantsToChange: string
  submittedAt:   string
}

export interface PlanContext {
  type:      'diet' | 'workout'
  label:     string               // e.g. "Almoço - Segunda"
  date:      string               // YYYY-MM-DD
  mealType?: string               // for diet: 'breakfast' | 'lunch' | ...
  item:      PlannedMeal | WorkoutSession
}

// ─── NAVIGATION ──────────────────────────────────────────────────────────
export type RootStackParamList = {
  Onboarding: undefined
  Main: undefined
}

export type TabParamList = {
  Home: undefined
  Scan: undefined
  Diet: undefined
  Workout: undefined
  Ranks: undefined
  Coop: undefined
  Optimize: undefined
  Routine: undefined
  Coach: undefined
  Subscription: undefined
  Profile: undefined
}
