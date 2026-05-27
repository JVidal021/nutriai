/**
 * Edge Function: exercise-gif
 * Busca GIF animado + instruções de um exercício via ExerciseDB (RapidAPI).
 * Usa 4 estratégias em cascata para maximizar o hit rate:
 *   1. Nome completo em inglês
 *   2. Nome sem prefixo de equipamento
 *   3. Palavra-chave principal do movimento
 *   4. Grupo muscular (body part) como último recurso
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RAPIDAPI_KEY  = Deno.env.get('RAPIDAPI_KEY') ?? ''
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!

const HOST = 'exercisedb.p.rapidapi.com'

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Prefixos de equipamento a remover na estratégia 2
const EQUIPMENT_PREFIXES = [
  'barbell', 'dumbbell', 'cable', 'machine', 'kettlebell',
  'ez bar', 'ez-bar', 'resistance band', 'band', 'smith',
  'trap bar', 'hex bar', 'swiss bar',
]

// Mapeamento de bodyPart PT→EN para a estratégia 4
const BODY_PART_MAP: Record<string, string> = {
  chest: 'chest', peito: 'chest',
  back: 'back', costas: 'back',
  shoulders: 'shoulders', ombros: 'shoulders',
  biceps: 'upper arms', bíceps: 'upper arms', biceps: 'upper arms',
  triceps: 'upper arms', tríceps: 'upper arms',
  abs: 'waist', abdomen: 'waist', abdômen: 'waist', core: 'waist',
  legs: 'upper legs', pernas: 'upper legs', quads: 'upper legs',
  glutes: 'upper legs', glúteos: 'upper legs',
  hamstrings: 'upper legs', calves: 'lower legs', panturrilhas: 'lower legs',
  forearms: 'lower arms', antebraço: 'lower arms',
  cardio: 'cardio', neck: 'neck', pescoço: 'neck',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (!RAPIDAPI_KEY) return errRes(503, 'Serviço temporariamente indisponível.')

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return errRes(401, 'Não autorizado')

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return errRes(401, 'Token inválido')

    const body = await req.json()
    const searchName: string = (body.searchName ?? '').toLowerCase().trim()
    const bodyPart:   string = (body.bodyPart   ?? '').toLowerCase().trim()

    if (!searchName) return errRes(400, 'searchName é obrigatório')

    const rapidHeaders = {
      'X-RapidAPI-Key':  RAPIDAPI_KEY,
      'X-RapidAPI-Host': HOST,
    }

    const result = await multiStrategySearch(searchName, bodyPart, rapidHeaders)

    console.log(`[exercise-gif] "${searchName}" (${bodyPart}) → ${result ? 'found' : 'not found'}`)

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('exercise-gif error:', err)
    return errRes(500, 'Erro interno.')
  }
})

// ─── Busca em 4 estratégias ───────────────────────────────────────────────
async function multiStrategySearch(
  name: string,
  bodyPart: string,
  headers: Record<string, string>,
) {
  // Estratégia 1: nome completo exato
  let result = await searchByName(name, headers)
  if (result) { console.log('[exercise-gif] hit: strategy 1'); return result }

  // Estratégia 2: remover prefixo de equipamento
  const stripped = stripEquipmentPrefix(name)
  if (stripped && stripped !== name) {
    result = await searchByName(stripped, headers)
    if (result) { console.log('[exercise-gif] hit: strategy 2'); return result }
  }

  // Estratégia 3: palavra-chave principal do movimento (palavra mais longa > 4 chars)
  const keyword = longestWord(name)
  if (keyword && keyword !== stripped) {
    result = await searchByName(keyword, headers)
    if (result) { console.log('[exercise-gif] hit: strategy 3'); return result }
  }

  // Estratégia 4: busca por grupo muscular → primeiro resultado
  const bpEn = BODY_PART_MAP[bodyPart] ?? bodyPart
  if (bpEn) {
    result = await searchByBodyPart(bpEn, name, headers)
    if (result) { console.log('[exercise-gif] hit: strategy 4 (bodyPart)'); return result }
  }

  return null
}

// ─── Busca por nome (match parcial no ExerciseDB) ─────────────────────────
async function searchByName(name: string, headers: Record<string, string>) {
  try {
    const res = await fetch(
      `https://${HOST}/exercises/name/${encodeURIComponent(name)}?limit=1&offset=0`,
      { headers },
    )
    if (!res.ok) {
      console.warn('[exercise-gif] name search HTTP', res.status, name)
      return null
    }
    const data = await res.json()
    return Array.isArray(data) && data.length > 0 ? formatResult(data[0]) : null
  } catch {
    return null
  }
}

// ─── Busca por grupo muscular ─────────────────────────────────────────────
async function searchByBodyPart(
  bodyPart: string,
  originalName: string,
  headers: Record<string, string>,
) {
  try {
    const res = await fetch(
      `https://${HOST}/exercises/bodyPart/${encodeURIComponent(bodyPart)}?limit=20&offset=0`,
      { headers },
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null

    // Tenta achar o que mais se parece com o nome original
    const lowerName = originalName.toLowerCase()
    const scored = data.map((ex: Record<string, unknown>) => {
      const exName = (ex.name as string).toLowerCase()
      // Score: quantas palavras do exercício original aparecem no nome do banco
      const words  = lowerName.split(' ').filter(w => w.length > 3)
      const score  = words.filter(w => exName.includes(w)).length
      return { ex, score }
    })

    scored.sort((a, b) => b.score - a.score)
    return formatResult(scored[0].ex)
  } catch {
    return null
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function stripEquipmentPrefix(name: string): string {
  let result = name
  for (const prefix of EQUIPMENT_PREFIXES) {
    const re = new RegExp(`^${prefix}\\s+`, 'i')
    if (re.test(result)) {
      result = result.replace(re, '').trim()
      break
    }
  }
  return result
}

function longestWord(name: string): string {
  return name
    .split(' ')
    .filter(w => w.length > 4)
    .sort((a, b) => b.length - a.length)[0] ?? ''
}

function formatResult(ex: Record<string, unknown>) {
  const instructions = Array.isArray(ex.instructions)
    ? (ex.instructions as string[]).slice(0, 4)
    : []
  return {
    gifUrl:       ex.gifUrl    as string,
    targetMuscle: ex.target    as string,
    equipment:    ex.equipment as string,
    bodyPart:     ex.bodyPart  as string,
    instructions,
  }
}

function errRes(status: number, message: string) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...cors, 'Content-Type': 'application/json' } }
  )
}
