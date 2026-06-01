import * as FileSystem from 'expo-file-system/legacy'
import * as ImageManipulator from 'expo-image-manipulator'
import { supabase } from './supabase'
import type { ScanResult, ChatMessage, DailyDietPlan, WorkoutSession, PlanContext } from '../types'

// ─── URL das Edge Functions ───────────────────────────────────────────────
function edgeFunctionUrl(name: string): string {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
  return `${base}/functions/v1/${name}`
}

// Timeout por função (ms). generate-plan gera a semana inteira via IA → mais lento.
const TIMEOUTS: Record<string, number> = {
  'generate-plan': 90_000,  // dieta/treino da semana
  'analyze-meal':  45_000,  // visão + TACO
  'coach-message': 45_000,
  'swap-item':     45_000,
  'exercise-gif':  20_000,
}
const DEFAULT_TIMEOUT = 30_000

// Mensagem de timeout — chave i18n resolvida na camada de UI via err.message.
// Aqui usamos um marcador reconhecível para a UI poder traduzir se quiser.
const TIMEOUT_ERROR = 'TIMEOUT'

// ─── Helper autenticado ───────────────────────────────────────────────────
async function callEdgeFunction(
  name: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Usuário não autenticado')

  // Timeout via AbortController — evita spinner eterno se a API travar
  const controller = new AbortController()
  const ms = TIMEOUTS[name] ?? DEFAULT_TIMEOUT
  const timer = setTimeout(() => controller.abort(), ms)

  let res: Response
  try {
    res = await fetch(edgeFunctionUrl(name), {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(TIMEOUT_ERROR)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }

  const json = await res.json()
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? `Erro ${res.status} em ${name}`)
  }
  return json.data
}

// ─── FIX 4: ANÁLISE DE FOTO com compressão ────────────────────────────────
export async function analyzeMealPhoto(photoUri: string): Promise<ScanResult> {
  // 1. Comprimir a imagem para economizar memória e custo de API
  const compressed = await ImageManipulator.manipulateAsync(
    photoUri,
    [{ resize: { width: 800 } }],
    {
      compress: 0.7,
      format:   ImageManipulator.SaveFormat.JPEG,
    }
  )

  // 2. Converter para base64
  const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
    encoding: FileSystem.EncodingType.Base64,
  })

  // 3. Verificar tamanho (segurança extra)
  if (base64.length > 4_000_000) {
    throw new Error('Imagem ainda muito grande após compressão. Tente com melhor iluminação.')
  }

  return callEdgeFunction('analyze-meal', {
    imageBase64: base64,
    mimeType:    'image/jpeg',
  }) as Promise<ScanResult>
}

// ─── GERAÇÃO DE PLANO ALIMENTAR ───────────────────────────────────────────
export async function generateDietPlan(moodAdjust = 0, previousFeedback = ''): Promise<DailyDietPlan[]> {
  const result = await callEdgeFunction('generate-plan', {
    type: 'diet',
    moodAdjust,
    previousFeedback,
  }) as { days?: DailyDietPlan[] }
  return result?.days ?? []
}

// ─── GERAÇÃO DE TREINO ────────────────────────────────────────────────────
export async function generateWorkoutPlan(moodAdjust = 0, previousFeedback = ''): Promise<WorkoutSession[]> {
  const result = await callEdgeFunction('generate-plan', {
    type: 'workout',
    moodAdjust,
    previousFeedback,
  }) as { days?: WorkoutSession[] }
  return result?.days ?? []
}

// ─── GIF DO EXERCÍCIO (ExerciseDB via proxy) ─────────────────────────────
export interface ExerciseGifData {
  gifUrl:       string
  targetMuscle: string
  equipment:    string
  bodyPart:     string
  instructions: string[]
}

// Cache em memória — evita chamadas repetidas na mesma sessão
const gifCache = new Map<string, ExerciseGifData | null>()

export async function fetchExerciseGif(
  searchName: string,
  bodyPart?: string,
): Promise<ExerciseGifData | null> {
  const key = searchName.toLowerCase().trim()
  if (gifCache.has(key)) return gifCache.get(key)!

  const result = await callEdgeFunction('exercise-gif', {
    searchName: key,
    bodyPart: bodyPart?.toLowerCase().trim() ?? '',
  }) as { data: ExerciseGifData | null }
  gifCache.set(key, result?.data ?? null)
  return result?.data ?? null
}

// ─── TROCA DE ITEM DO PLANO ───────────────────────────────────────────────
export async function swapPlanItem(
  type:        'meal' | 'workout',
  currentItem: Record<string, unknown>,
  date:        string,
  reason:      string,
): Promise<Record<string, unknown>> {
  const result = await callEdgeFunction('swap-item', {
    type,
    currentItem,
    date,
    reason,
  }) as { newItem: Record<string, unknown> }
  return result.newItem
}

// ─── FIX 5: COACH — retorna string simples ───────────────────────────────
export async function sendCoachMessage(
  userMessage: string,
  history: ChatMessage[],
  context?: {
    todayCalories?:  number
    targetCalories?: number
    workoutDone?:    boolean
    streak?:         number
  },
  planContext?: PlanContext | null,
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Usuário não autenticado')

  const res = await fetch(edgeFunctionUrl('coach-message'), {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      message: userMessage,
      history: history.slice(-10).map((m) => ({
        role:    m.role,
        content: m.content,
      })),
      context,
      planContext: planContext ?? null,
      stream: false,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Erro ${res.status}` }))
    throw new Error(err.error ?? `Erro ${res.status}`)
  }

  const json = await res.json()

  // Suporta diferentes formatos de resposta
  if (typeof json.response === 'string') return json.response
  if (json.choices?.[0]?.message?.content) return json.choices[0].message.content
  if (typeof json === 'string') return json

  throw new Error('Resposta inválida do servidor')
}
// ─── ANÁLISE POR TEXTO ────────────────────────────────────────────────────
export async function analyzeMealText(description: string): Promise<ScanResult> {
  return callEdgeFunction('analyze-meal', {
    textDescription: description.trim(),
    mimeType:        'text',
  }) as Promise<ScanResult>
}
