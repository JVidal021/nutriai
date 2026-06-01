import { Dimensions } from 'react-native'
import type { Rank } from '@/types/index'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

// ─── COLORS ──────────────────────────────────────────────────────────────
export const Colors = {
  bg:       '#0A0A0A',
  bg2:      '#111111',
  bg3:      '#1A1A1A',
  bg4:      '#222222',
  border:   '#1C1C1C',
  border2:  '#333333',
  text:     '#F0F0F0',
  text2:    '#888888',
  text3:    '#555555',
  accent:   '#C8F060',
  accent2:  '#A8D040',
  purple:   '#8B7FFF',
  teal:     '#2DD4AA',
  orange:   '#FF7A45',
  red:      '#FF4F4F',
  gold:     '#FFD700',

  // Semantic
  success:  '#2DD4AA',
  warning:  '#FF7A45',
  info:     '#8B7FFF',
  error:    '#FF4F4F',

  // Translucent
  accentAlpha12:  'rgba(200,240,96,0.12)',
  accentAlpha20:  'rgba(200,240,96,0.20)',
  purpleAlpha15:  'rgba(139,127,255,0.15)',
  tealAlpha15:    'rgba(45,212,170,0.15)',
  orangeAlpha15:  'rgba(255,122,69,0.15)',
  redAlpha15:     'rgba(255,79,79,0.15)',
  whiteAlpha08:   'rgba(255,255,255,0.08)',
  whiteAlpha14:   'rgba(255,255,255,0.14)',
  blackAlpha70:   'rgba(0,0,0,0.70)',
} as const

// ─── TYPOGRAPHY ──────────────────────────────────────────────────────────
// Nomes exatos que devem ser passados como fontFamily nos StyleSheets.
// As fontes são carregadas em app/_layout.tsx via useFonts().
export const Fonts = {
  head:   'Syne_800ExtraBold',
  headSm: 'Syne_600SemiBold',
  body:   'DMSans_400Regular',
  bodyMd: 'DMSans_500Medium',
  bodySm: 'DMSans_300Light',
} as const

export const FontSizes = {
  xs:   10,
  sm:   12,
  md:   14,
  base: 16,
  lg:   18,
  xl:   20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 34,
  '5xl': 42,
} as const

// ─── SPACING ─────────────────────────────────────────────────────────────
export const Spacing = {
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '8': 32,
  '10': 40,
  '12': 48,
  '16': 64,
} as const

// ─── BORDER RADIUS ───────────────────────────────────────────────────────
export const Radius = {
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  '2xl': 24,
  full: 9999,
} as const

// ─── SCREEN ──────────────────────────────────────────────────────────────
export const Screen = {
  width:  SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
} as const

// ─── RANKS ───────────────────────────────────────────────────────────────
export const RANKS: Rank[] = [
  { tier: 'bronze',   level: 1, emoji: '🥉', label: 'Bronze I',    minXp: 0,     maxXp: 333  },
  { tier: 'bronze',   level: 2, emoji: '🥉', label: 'Bronze II',   minXp: 334,   maxXp: 666  },
  { tier: 'bronze',   level: 3, emoji: '🥉', label: 'Bronze III',  minXp: 667,   maxXp: 999  },
  { tier: 'silver',   level: 1, emoji: '🥈', label: 'Prata I',     minXp: 1000,  maxXp: 1666 },
  { tier: 'silver',   level: 2, emoji: '🥈', label: 'Prata II',    minXp: 1667,  maxXp: 2333 },
  { tier: 'silver',   level: 3, emoji: '🥈', label: 'Prata III',   minXp: 2334,  maxXp: 3000 },
  { tier: 'gold',     level: 1, emoji: '🥇', label: 'Ouro I',      minXp: 3001,  maxXp: 4333 },
  { tier: 'gold',     level: 2, emoji: '🥇', label: 'Ouro II',     minXp: 4334,  maxXp: 5666 },
  { tier: 'gold',     level: 3, emoji: '🥇', label: 'Ouro III',    minXp: 5667,  maxXp: 7000 },
  { tier: 'diamond',  level: 1, emoji: '💎', label: 'Diamante I',  minXp: 7001,  maxXp: 9666 },
  { tier: 'diamond',  level: 2, emoji: '💎', label: 'Diamante II', minXp: 9667,  maxXp: 12333},
  { tier: 'diamond',  level: 3, emoji: '💎', label: 'Diamante III',minXp: 12334, maxXp: 15000},
  { tier: 'legendary',level: 1, emoji: '👑', label: 'Lendário',    minXp: 15001, maxXp: Infinity},
]

export const XP_VALUES = {
  MEAL_LOGGED:    15,
  WORKOUT_DONE:   40,
  GOAL_MET:       20,
  STREAK_7_DAYS:  100,
  CHECKIN_DONE:   5,
  COOP_CHALLENGE: 500,
} as const

// ─── PROFILES ────────────────────────────────────────────────────────────
export const PROFILES = [
  {
    id: 'escultura',
    emoji: '🔥',
    title: 'Escultura',
    description: 'Força, definição muscular e hipertrofia',
    bonus: '+15% XP em treino de força',
    xpMultiplierEvent: 'workout',
  },
  {
    id: 'vitalidade',
    emoji: '⚡',
    title: 'Vitalidade',
    description: 'Cardio, agilidade e energia',
    bonus: '+15% XP em passos e corrida',
    xpMultiplierEvent: 'steps',
  },
  {
    id: 'harmonia',
    emoji: '🌿',
    title: 'Harmonia',
    description: 'Bem-estar, mobilidade e consistência',
    bonus: '+15% XP em sequência diária',
    xpMultiplierEvent: 'streak',
  },
] as const

// ─── MOODS ───────────────────────────────────────────────────────────────
export const MOODS = [
  { id: 'great',    emoji: '😄', label: 'Ótimo',   workoutIntensity: 1.1,  calorieAdjust: 0    },
  { id: 'good',     emoji: '🙂', label: 'Bem',     workoutIntensity: 1.0,  calorieAdjust: 0    },
  { id: 'neutral',  emoji: '😐', label: 'Neutro',  workoutIntensity: 1.0,  calorieAdjust: 0    },
  { id: 'tired',    emoji: '😔', label: 'Cansado', workoutIntensity: 0.6,  calorieAdjust: -120 },
  { id: 'exhausted',emoji: '😫', label: 'Exausto', workoutIntensity: 0.3,  calorieAdjust: -200 },
] as const
