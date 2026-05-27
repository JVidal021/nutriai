import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GROQ_KEY      = Deno.env.get('GROQ_API_KEY') ?? ''
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!

const FREE_DAILY_LIMIT = 5

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  if (!GROQ_KEY) return errRes(503, 'Serviço temporariamente indisponível.')

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return errRes(401, 'Não autorizado')

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return errRes(401, 'Token inválido')

    // Carregar perfil (inclui flags de premium)
    const { data: profile } = await supabase
      .from('users')
      .select('name,gender,goal,profile,weight,target_weight,restrictions,is_premium,premium_expires_at')
      .eq('id', user.id)
      .single()

    // ── Rate limiting para usuários gratuitos ──────────────────────────────
    const premiumActive = profile?.is_premium &&
      (!profile.premium_expires_at || new Date(profile.premium_expires_at) > new Date())

    if (!premiumActive) {
      const today = new Date().toISOString().split('T')[0]
      const { count } = await supabase
        .from('coach_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('sent_at', `${today}T00:00:00`)

      if ((count ?? 0) >= FREE_DAILY_LIMIT) {
        return errRes(
          429,
          `Limite de ${FREE_DAILY_LIMIT} mensagens por dia atingido. Faça upgrade para Premium e tenha coach ilimitado! 👑`
        )
      }

      // Registrar esta mensagem
      await supabase.from('coach_logs').insert({ user_id: user.id })
    }

    const { message, history = [], context = {}, planContext = null } = await req.json()
    if (!message || typeof message !== 'string') return errRes(400, 'Mensagem inválida')

    const gMap: Record<string, string> = { masc: 'homem', fem: 'mulher', neu: 'pessoa', skip: 'pessoa' }

    // Contexto de item do plano (quando usuário pede ajuda sobre uma refeição ou treino específico)
    const planCtxBlock = planContext
      ? `\n\nContexto do plano em discussão (${planContext.label}):\n${JSON.stringify(planContext.item, null, 2)}\n\nSe o usuário pedir para trocar ou ajustar este item, sugira uma alternativa concreta e detalhada.`
      : ''

    const sys = `Você é o Coach NutriAI. Responda em português brasileiro.\nUsuário: ${profile?.name} | ${gMap[profile?.gender ?? 'neu']} | Objetivo: ${profile?.goal}\nPeso: ${profile?.weight}kg → Meta: ${profile?.target_weight}kg\n${context.todayCalories ? `Hoje: ${context.todayCalories}/${context.targetCalories}kcal | Treino: ${context.workoutDone ? 'feito' : 'pendente'}` : ''}${planCtxBlock}\nSeja direto, empático e motivador. Máximo 3 parágrafos curtos.`

    const msgs = [
      { role: 'system', content: sys },
      ...history.slice(-10).filter((m: { role: string }) => ['user', 'assistant'].includes(m.role)),
      { role: 'user', content: String(message).slice(0, 1000) },
    ]

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        messages:    msgs,
        max_tokens:  600,
        temperature: 0.75,
        stream:      false,
      }),
    })

    if (!groqRes.ok) return errRes(502, 'Coach indisponível no momento. Tente novamente.')

    const data     = await groqRes.json()
    const response = data.choices?.[0]?.message?.content ?? 'Não consegui responder. Tente novamente.'

    return new Response(
      JSON.stringify({ success: true, response }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('coach-message error:', err)
    return errRes(500, 'Erro interno.')
  }
})

function errRes(status: number, message: string) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } }
  )
}
