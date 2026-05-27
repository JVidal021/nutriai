/**
 * Edge Function: analyze-meal
 * Recebe a foto em base64, chama o Gemini Vision no servidor
 * e retorna o resultado. A chave Gemini nunca vai para o cliente.
 *
 * Deploy: supabase functions deploy analyze-meal
 * Variável de ambiente: supabase secrets set GEMINI_API_KEY=sua_chave
 *
 * Pré-requisito: executar supabase/migrations/scan_logs.sql no banco.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_KEY        = Deno.env.get('GEMINI_API_KEY') ?? ''
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const RATE_LIMIT_FREE    = 3   // análises por dia para plano grátis
const RATE_LIMIT_PREMIUM = 999 // ilimitado na prática

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verificar autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return errorResponse(401, 'Não autorizado')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return errorResponse(401, 'Token inválido ou expirado')
    }

    // 2. Verificar plano e rate limit via banco de dados
    // BUG 12 FIX: persistente no banco em vez de Map em memória (reseta no cold start)
    const { data: userData } = await supabase
      .from('users')
      .select('is_premium')
      .eq('id', user.id)
      .single()

    const isPremium = userData?.is_premium ?? false
    const limit     = isPremium ? RATE_LIMIT_PREMIUM : RATE_LIMIT_FREE

    try {
      const today = new Date().toISOString().split('T')[0]
      const { count } = await supabase
        .from('scan_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('scanned_at', `${today}T00:00:00.000Z`)
        .lte('scanned_at', `${today}T23:59:59.999Z`)

      if ((count ?? 0) >= limit) {
        return errorResponse(429, isPremium
          ? 'Limite diário atingido'
          : `Plano grátis permite ${RATE_LIMIT_FREE} análises por dia. Faça upgrade para Premium.`
        )
      }
    } catch (e) {
      // Tabela ainda não criada: prosseguir sem rate limit até a migration ser aplicada
      console.warn('scan_logs indisponível, pulando rate limit:', e)
    }

    // 3. Validar chave Gemini
    if (!GEMINI_KEY) {
      console.error('GEMINI_API_KEY não configurada nas secrets da Edge Function')
      return errorResponse(503, 'Serviço de análise não configurado. Contate o suporte.')
    }

    // 4. Validar payload
    const body = await req.json()
    const { imageBase64, textDescription, mimeType = 'image/jpeg' } = body

    const isText  = mimeType === 'text' || (typeof textDescription === 'string' && textDescription.length > 0)
    const isImage = typeof imageBase64 === 'string' && imageBase64.length > 0

    if (!isText && !isImage) {
      return errorResponse(400, 'Informe a imagem ou a descrição da refeição')
    }

    if (isImage && imageBase64.length > 5_500_000) {
      return errorResponse(413, 'Imagem muito grande. Redimensione antes de enviar.')
    }

    // 5. Chamar Gemini (chave fica no servidor)
    // BUG 1+2 FIX: prompts reescritos — sem aspas ao redor da descrição e sem
    // "string"/"number" como literais, que confundiam o modelo e geravam texto
    // explicativo em vez de JSON puro.
    const textModePrompt = `Você é nutricionista especializado em culinária brasileira.

Refeição descrita pelo usuário:
${textDescription}

IMPORTANTE: Se o usuário não informar as quantidades, estime porções típicas brasileiras:
- Prato de almoço/jantar: ~150g arroz, ~100g feijão, ~120g proteína, ~80g salada
- Lanche: porções individuais padrão
- Café da manhã: porções habituais brasileiras
Use o bom senso e contexto cultural para estimar porções realistas.

Retorne SOMENTE um objeto JSON, sem nenhum texto antes ou depois.

Exemplo de formato esperado:
{
  "foods": [
    { "name": "arroz branco cozido", "quantity_g": 150, "calories": 195, "protein_g": 4, "carbs_g": 43, "fat_g": 0.3 },
    { "name": "feijão carioca cozido", "quantity_g": 100, "calories": 77, "protein_g": 5, "carbs_g": 14, "fat_g": 0.5 }
  ],
  "total": { "calories": 272, "protein": 9, "carbs": 57, "fat": 0.8 },
  "confidence": 75,
  "notes": "Quantidades estimadas para porção típica brasileira"
}`

    const imageModePrompt = `Você é nutricionista especializado em culinária brasileira. Analise a imagem do prato.

Retorne SOMENTE um objeto JSON, sem nenhum texto antes ou depois.

Exemplo de formato esperado:
{
  "foods": [
    { "name": "frango grelhado", "quantity_g": 120, "calories": 198, "protein_g": 37, "carbs_g": 0, "fat_g": 4.3 }
  ],
  "total": { "calories": 198, "protein": 37, "carbs": 0, "fat": 4.3 },
  "confidence": 78,
  "notes": "Estimativa visual para porção típica"
}

Regras:
- Reconheça pratos brasileiros típicos (feijoada, tapioca, açaí, moqueca, coxinha, pão de queijo, etc.)
- Estime porções realistas para o contexto brasileiro
- confidence de 0 a 100 refletindo sua certeza
- notes em português, máx 100 caracteres`

    const geminiPayload = {
      contents: [{
        parts: isImage
          ? [
              { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
              { text: imageModePrompt },
            ]
          : [
              { text: textModePrompt },
            ],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        // thinkingConfig DENTRO de generationConfig (campo top-level não existe na API)
        thinkingConfig: { thinkingBudget: 0 },
      },
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiPayload) }
    )

    if (!geminiRes.ok) {
      const geminiErrText = await geminiRes.text()
      console.error(`Gemini error ${geminiRes.status}:`, geminiErrText)

      if (geminiRes.status === 400) {
        return errorResponse(502, 'Chave da API Gemini inválida ou requisição malformada.')
      }
      if (geminiRes.status === 403) {
        return errorResponse(502, 'Chave da API Gemini sem permissão. Verifique a secret GEMINI_API_KEY.')
      }
      if (geminiRes.status === 429) {
        return errorResponse(429, 'Cota da API Gemini esgotada. Tente novamente mais tarde.')
      }
      return errorResponse(502, 'Serviço de análise indisponível. Tente novamente.')
    }

    const geminiData = await geminiRes.json()
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // BUG 3 FIX: extração de JSON robusta — remove markdown em qualquer capitalização,
    // e faz fallback com regex para encontrar o objeto JSON mesmo com texto ao redor.
    const stripped = rawText
      .replace(/```(?:json|JSON)?\s*/g, '')
      .replace(/```/g, '')
      .trim()

    const jsonMatch = stripped.match(/\{[\s\S]*\}/)

    let result
    try {
      if (!jsonMatch) throw new Error('JSON não encontrado na resposta')
      result = JSON.parse(jsonMatch[0])
    } catch {
      // BUG 4 FIX: mensagem de erro contextual por modo (foto vs texto)
      console.error('Falha ao parsear resposta do Gemini. Raw:', rawText)
      const msg = isImage
        ? 'Não foi possível identificar os alimentos. Tente com melhor iluminação.'
        : 'Não foi possível estimar os nutrientes. Tente descrever com mais detalhes (ex: "150g de arroz com feijão e frango grelhado").'
      return errorResponse(422, msg)
    }

    // 6. Registrar scan no banco para rate limiting (fire-and-forget)
    try {
      await supabase.from('scan_logs').insert({ user_id: user.id })
    } catch (e) {
      console.warn('Falha ao registrar scan_log:', e)
    }

    // 7. Retornar resultado com header de uso
    // FIX: .catch() não existe no query builder do Supabase — usar try/catch
    let usedCount = 1
    try {
      const { count } = await supabase
        .from('scan_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('scanned_at', `${new Date().toISOString().split('T')[0]}T00:00:00.000Z`)
      usedCount = count ?? 1
    } catch {
      // fallback silencioso — não impede a resposta
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-RateLimit-Limit':     String(limit),
        'X-RateLimit-Remaining': String(Math.max(0, limit - usedCount)),
      },
    })

  } catch (err) {
    console.error('Unexpected error:', err)
    return errorResponse(500, 'Erro interno. Tente novamente.')
  }
})

function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
