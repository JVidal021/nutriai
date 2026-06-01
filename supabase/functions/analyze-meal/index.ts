/**
 * Edge Function: analyze-meal v2
 * Recebe foto em base64 ou descrição de texto, chama Gemini Vision,
 * valida com tabela TACO e retorna macros precisos.
 *
 * Melhorias v2:
 *  - thinkingBudget: 1024 (raciocínio ativado → mais preciso em pratos compostos)
 *  - Contexto do perfil do usuário injetado no prompt
 *  - Pós-processamento com tabela TACO brasileira (UNICAMP)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_KEY        = Deno.env.get('GEMINI_API_KEY') ?? ''
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const RATE_LIMIT_FREE    = 3
const RATE_LIMIT_PREMIUM = 999

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── TABELA TACO (valores por 100g) ───────────────────────────────────────
// Fonte: TACO — Tabela Brasileira de Composição de Alimentos (UNICAMP)
const TACO: Record<string, { cal: number; prot: number; carb: number; fat: number }> = {
  'arroz branco cozido':       { cal: 128, prot: 2.5,  carb: 28.1, fat: 0.2  },
  'arroz integral cozido':     { cal: 124, prot: 2.6,  carb: 25.8, fat: 1.0  },
  'feijao carioca cozido':     { cal: 76,  prot: 4.8,  carb: 13.6, fat: 0.5  },
  'feijao preto cozido':       { cal: 77,  prot: 4.5,  carb: 14.0, fat: 0.5  },
  'feijao cozido':             { cal: 76,  prot: 4.8,  carb: 13.6, fat: 0.5  },
  'frango grelhado':           { cal: 163, prot: 31.5, carb: 0,    fat: 3.7  },
  'frango cozido':             { cal: 170, prot: 32.0, carb: 0,    fat: 4.0  },
  'frango assado':             { cal: 187, prot: 30.5, carb: 0,    fat: 7.0  },
  'peito de frango grelhado':  { cal: 159, prot: 32.9, carb: 0,    fat: 2.5  },
  'carne bovina grelhada':     { cal: 219, prot: 30.7, carb: 0,    fat: 10.4 },
  'carne moida refogada':      { cal: 231, prot: 26.4, carb: 2.4,  fat: 13.0 },
  'patinho grelhado':          { cal: 179, prot: 30.0, carb: 0,    fat: 6.0  },
  'ovo cozido':                { cal: 146, prot: 13.3, carb: 0.6,  fat: 9.5  },
  'ovo mexido':                { cal: 159, prot: 11.3, carb: 1.0,  fat: 12.0 },
  'omelete':                   { cal: 154, prot: 10.6, carb: 1.2,  fat: 12.0 },
  'batata cozida':             { cal: 52,  prot: 1.2,  carb: 11.9, fat: 0.1  },
  'batata frita':              { cal: 271, prot: 3.4,  carb: 36.5, fat: 12.6 },
  'batata doce cozida':        { cal: 77,  prot: 0.6,  carb: 18.4, fat: 0.1  },
  'macarrao cozido':           { cal: 110, prot: 3.8,  carb: 22.9, fat: 0.5  },
  'espaguete cozido':          { cal: 110, prot: 3.8,  carb: 22.9, fat: 0.5  },
  'pao frances':               { cal: 300, prot: 8.0,  carb: 58.6, fat: 3.1  },
  'pao de queijo':             { cal: 376, prot: 7.5,  carb: 52.5, fat: 15.0 },
  'tapioca':                   { cal: 357, prot: 0.6,  carb: 88.7, fat: 0.3  },
  'mandioca cozida':           { cal: 125, prot: 0.6,  carb: 30.1, fat: 0.3  },
  'inhame cozido':             { cal: 101, prot: 1.5,  carb: 23.1, fat: 0.2  },
  'banana':                    { cal: 98,  prot: 1.3,  carb: 26.0, fat: 0.1  },
  'maca':                      { cal: 56,  prot: 0.3,  carb: 15.2, fat: 0.1  },
  'laranja':                   { cal: 37,  prot: 0.9,  carb: 8.9,  fat: 0.1  },
  'mamao':                     { cal: 40,  prot: 0.5,  carb: 10.4, fat: 0.1  },
  'manga':                     { cal: 64,  prot: 0.4,  carb: 17.0, fat: 0.3  },
  'abacate':                   { cal: 96,  prot: 1.2,  carb: 8.8,  fat: 6.4  },
  'uva':                       { cal: 69,  prot: 0.6,  carb: 17.7, fat: 0.1  },
  'morango':                   { cal: 30,  prot: 0.9,  carb: 7.0,  fat: 0.3  },
  'leite integral':            { cal: 61,  prot: 3.2,  carb: 4.7,  fat: 3.2  },
  'leite desnatado':           { cal: 35,  prot: 3.4,  carb: 4.9,  fat: 0.2  },
  'queijo minas frescal':      { cal: 264, prot: 17.4, carb: 3.2,  fat: 20.2 },
  'queijo mussarela':          { cal: 327, prot: 24.5, carb: 2.4,  fat: 24.5 },
  'queijo prato':              { cal: 358, prot: 26.0, carb: 2.0,  fat: 27.0 },
  'requeijao cremoso':         { cal: 267, prot: 8.9,  carb: 4.3,  fat: 24.4 },
  'iogurte natural':           { cal: 51,  prot: 3.5,  carb: 4.4,  fat: 1.8  },
  'iogurte grego':             { cal: 115, prot: 9.0,  carb: 4.0,  fat: 7.0  },
  'manteiga':                  { cal: 726, prot: 0.5,  carb: 0,    fat: 80.5 },
  'azeite':                    { cal: 884, prot: 0,    carb: 0,    fat: 100  },
  'oleo de soja':              { cal: 884, prot: 0,    carb: 0,    fat: 100  },
  'alface':                    { cal: 11,  prot: 1.0,  carb: 1.7,  fat: 0.2  },
  'tomate':                    { cal: 15,  prot: 0.9,  carb: 3.1,  fat: 0.2  },
  'cenoura':                   { cal: 34,  prot: 0.6,  carb: 8.2,  fat: 0.1  },
  'couve cozida':              { cal: 19,  prot: 2.1,  carb: 3.4,  fat: 0.3  },
  'brocolis':                  { cal: 25,  prot: 2.2,  carb: 4.4,  fat: 0.3  },
  'abobrinha cozida':          { cal: 14,  prot: 0.8,  carb: 2.7,  fat: 0.2  },
  'cebola':                    { cal: 40,  prot: 1.5,  carb: 8.6,  fat: 0.2  },
  'pepino':                    { cal: 10,  prot: 0.5,  carb: 2.0,  fat: 0.1  },
  'atum em lata':              { cal: 119, prot: 25.7, carb: 0,    fat: 1.4  },
  'sardinha em lata':          { cal: 170, prot: 23.0, carb: 0,    fat: 8.4  },
  'salmao grelhado':           { cal: 182, prot: 25.0, carb: 0,    fat: 8.8  },
  'tilapia grelhada':          { cal: 128, prot: 26.0, carb: 0,    fat: 2.3  },
  'aveia':                     { cal: 394, prot: 13.9, carb: 67.0, fat: 8.5  },
  'granola':                   { cal: 471, prot: 10.2, carb: 70.7, fat: 16.7 },
  'amendoim torrado':          { cal: 567, prot: 28.5, carb: 13.6, fat: 47.5 },
  'castanha de caju':          { cal: 570, prot: 18.5, carb: 29.1, fat: 46.3 },
  'amendoa':                   { cal: 579, prot: 21.2, carb: 21.7, fat: 50.6 },
  'presunto':                  { cal: 139, prot: 18.6, carb: 1.4,  fat: 6.3  },
  'carne suina grelhada':      { cal: 214, prot: 29.3, carb: 0,    fat: 10.6 },
  'linguica':                  { cal: 310, prot: 14.8, carb: 2.4,  fat: 27.2 },
  'acucar':                    { cal: 387, prot: 0,    carb: 99.6, fat: 0    },
  'mel':                       { cal: 309, prot: 0.3,  carb: 84.0, fat: 0    },
  'chocolate ao leite':        { cal: 550, prot: 7.5,  carb: 57.0, fat: 33.0 },
  'acai':                      { cal: 247, prot: 1.7,  carb: 24.0, fat: 16.6 },
  'whey protein':              { cal: 396, prot: 79.0, carb: 9.0,  fat: 4.0  },
  'sopa de legumes':           { cal: 45,  prot: 2.0,  carb: 8.0,  fat: 0.8  },
  'coco ralado':               { cal: 354, prot: 3.0,  carb: 36.1, fat: 23.9 },
}

function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
}

function lookupTACO(foodName: string): { cal: number; prot: number; carb: number; fat: number } | null {
  const norm = normalize(foodName)
  if (TACO[norm]) return TACO[norm]
  for (const [key, val] of Object.entries(TACO)) {
    const normKey = normalize(key)
    if (norm.includes(normKey) || normKey.includes(norm)) return val
    const mainWord = normKey.split(' ')[0]
    if (mainWord.length > 4 && norm.includes(mainWord)) return val
  }
  return null
}

function applyTACO(foods: any[]): { foods: any[]; tacoCount: number } {
  let tacoCount = 0
  const enriched = foods.map((food: any) => {
    const taco = lookupTACO(food.name)
    if (!taco) return { ...food, source: 'ai' }
    const ratio = food.quantity_g / 100
    tacoCount++
    return {
      ...food,
      calories:  Math.round(taco.cal  * ratio),
      protein_g: Math.round(taco.prot * ratio * 10) / 10,
      carbs_g:   Math.round(taco.carb * ratio * 10) / 10,
      fat_g:     Math.round(taco.fat  * ratio * 10) / 10,
      source: 'taco',
    }
  })
  return { foods: enriched, tacoCount }
}

// ─── SERVIDOR ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 1. Autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return errorResponse(401, 'Não autorizado')

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return errorResponse(401, 'Token inválido ou expirado')

    // 2. Buscar perfil completo para rate limit + contexto do prompt
    const { data: userData } = await supabase
      .from('users')
      .select('is_premium, goal, food_likes, food_dislikes, weight, target_weight')
      .eq('id', user.id)
      .single()

    const isPremium = userData?.is_premium ?? false
    const limit     = isPremium ? RATE_LIMIT_PREMIUM : RATE_LIMIT_FREE

    // 3. Rate limiting
    try {
      const today = new Date().toISOString().split('T')[0]
      const { count } = await supabase
        .from('scan_logs').select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('scanned_at', `${today}T00:00:00.000Z`)
        .lte('scanned_at', `${today}T23:59:59.999Z`)

      if ((count ?? 0) >= limit) {
        return errorResponse(429, isPremium
          ? 'Limite diário atingido'
          : `Plano grátis: ${RATE_LIMIT_FREE} análises por dia. Upgrade para Premium.`)
      }
    } catch (e) { console.warn('scan_logs indisponível:', e) }

    if (!GEMINI_KEY) return errorResponse(503, 'Serviço de análise não configurado.')

    // 4. Payload
    const body = await req.json()
    const { imageBase64, textDescription, mimeType = 'image/jpeg' } = body
    const isText  = mimeType === 'text' || (typeof textDescription === 'string' && textDescription.length > 0)
    const isImage = typeof imageBase64 === 'string' && imageBase64.length > 0
    if (!isText && !isImage) return errorResponse(400, 'Informe a imagem ou a descrição')
    if (isImage && imageBase64.length > 5_500_000) return errorResponse(413, 'Imagem muito grande.')

    // 5. Contexto do perfil do usuário para enriquecer o prompt
    const goalMap: Record<string, string> = {
      lose_weight: 'perda de peso (déficit calórico)',
      gain_muscle: 'ganho de massa muscular (superávit)',
      maintain:    'manutenção de peso',
      performance: 'performance e resistência',
    }
    const ctxLines = [
      userData?.goal         ? `Objetivo: ${goalMap[userData.goal] ?? userData.goal}` : '',
      userData?.food_likes   ? `Come frequentemente: ${userData.food_likes}` : '',
      userData?.food_dislikes ? `Evita: ${userData.food_dislikes}` : '',
      userData?.weight       ? `Peso atual: ${userData.weight}kg` : '',
    ].filter(Boolean)
    const contextBlock = ctxLines.length
      ? `\nPerfil do usuário (use para estimar porções mais realistas):\n${ctxLines.join('\n')}\n`
      : ''

    // 6. Prompts
    const textModePrompt = `Você é nutricionista especializado em culinária brasileira.
${contextBlock}
Refeição descrita: ${textDescription}

Se quantidades não informadas, estime porções típicas BR:
- Prato principal: ~150g arroz, ~100g feijão, ~120g proteína
- Lanche: porções individuais padrão

Retorne SOMENTE JSON (sem texto antes/depois):
{"foods":[{"name":"arroz branco cozido","quantity_g":150,"calories":192,"protein_g":3.8,"carbs_g":42.2,"fat_g":0.3}],"total":{"calories":192,"protein":3.8,"carbs":42.2,"fat":0.3},"confidence":75,"notes":"texto curto"}`

    const imageModePrompt = `Você é nutricionista especializado em culinária brasileira.
${contextBlock}
Analise a imagem do prato. Reconheça pratos BR típicos (feijoada, tapioca, açaí, coxinha, pão de queijo etc.).

Retorne SOMENTE JSON (sem texto antes/depois):
{"foods":[{"name":"frango grelhado","quantity_g":120,"calories":196,"protein_g":37.8,"carbs_g":0,"fat_g":4.4}],"total":{"calories":196,"protein":37.8,"carbs":0,"fat":4.4},"confidence":78,"notes":"texto curto"}`

    // 7. Gemini 2.5 Flash com thinking ativado (v2)
    const geminiPayload = {
      contents: [{
        parts: isImage
          ? [{ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }, { text: imageModePrompt }]
          : [{ text: textModePrompt }],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 1024 }, // v2: thinking ativado
      },
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiPayload) }
    )

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      console.error(`Gemini ${geminiRes.status}:`, errText)
      if (geminiRes.status === 429) return errorResponse(429, 'Cota da API esgotada. Tente mais tarde.')
      return errorResponse(502, 'Serviço indisponível. Tente novamente.')
    }

    const geminiData = await geminiRes.json()
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // 8. Parse robusto
    const stripped = rawText.replace(/```(?:json|JSON)?\s*/g, '').replace(/```/g, '').trim()
    const jsonMatch = stripped.match(/\{[\s\S]*\}/)
    let result: any
    try {
      if (!jsonMatch) throw new Error('JSON não encontrado')
      result = JSON.parse(jsonMatch[0])
    } catch {
      console.error('Parse error. Raw:', rawText)
      return errorResponse(422, isImage
        ? 'Não identificou os alimentos. Tente com melhor iluminação.'
        : 'Não estimou os nutrientes. Descreva com mais detalhes.')
    }

    // 9. Enriquecer com TACO
    if (Array.isArray(result.foods) && result.foods.length > 0) {
      const { foods: enriched, tacoCount } = applyTACO(result.foods)
      result.foods = enriched
      result.total = {
        calories: Math.round(enriched.reduce((s: number, f: any) => s + f.calories,  0)),
        protein:  Math.round(enriched.reduce((s: number, f: any) => s + f.protein_g, 0) * 10) / 10,
        carbs:    Math.round(enriched.reduce((s: number, f: any) => s + f.carbs_g,   0) * 10) / 10,
        fat:      Math.round(enriched.reduce((s: number, f: any) => s + f.fat_g,     0) * 10) / 10,
      }
      if (tacoCount > 0) {
        const pct = Math.round((tacoCount / enriched.length) * 100)
        result.tacoValidated = true
        result.notes = (result.notes ? result.notes + ' · ' : '') + `${pct}% validado pela tabela TACO`
      }
    }

    // 10. Registrar scan
    try { await supabase.from('scan_logs').insert({ user_id: user.id }) }
    catch (e) { console.warn('scan_log:', e) }

    let usedCount = 1
    try {
      const { count } = await supabase.from('scan_logs')
        .select('*', { count: 'exact', head: true }).eq('user_id', user.id)
        .gte('scanned_at', `${new Date().toISOString().split('T')[0]}T00:00:00.000Z`)
      usedCount = count ?? 1
    } catch { /* fallback */ }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-RateLimit-Limit':     String(limit),
        'X-RateLimit-Remaining': String(Math.max(0, limit - usedCount)),
      },
    })

  } catch (err) {
    console.error('Error:', err)
    return errorResponse(500, 'Erro interno. Tente novamente.')
  }
})

function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
