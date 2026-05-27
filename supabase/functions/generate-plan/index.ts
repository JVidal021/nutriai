/**
 * Edge Function: generate-plan
 * Gera plano alimentar e de treino semanal via Groq.
 * Aceita type = 'diet' | 'workout'
 *
 * Deploy: supabase functions deploy generate-plan
 * Secrets: supabase secrets set GROQ_API_KEY=seu_token
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GROQ_KEY       = Deno.env.get('GROQ_API_KEY') ?? ''
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON  = Deno.env.get('SUPABASE_ANON_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Retorna strings YYYY-MM-DD começando na segunda-feira da semana atual */
function getWeekDates(count: number): string[] {
  const today = new Date()
  const dow = today.getDay() // 0 = domingo
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!GROQ_KEY) return errorResponse(503, 'Serviço temporariamente indisponível.')

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return errorResponse(401, 'Não autorizado')

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return errorResponse(401, 'Token inválido')

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) return errorResponse(404, 'Perfil não encontrado')

    const premiumActive = profile.is_premium &&
      (!profile.premium_expires_at || new Date(profile.premium_expires_at) > new Date())
    if (!premiumActive) return errorResponse(403, 'Esta funcionalidade requer Premium')

    const { type, moodAdjust = 0, previousFeedback = '' } = await req.json()

    if (!['diet', 'workout'].includes(type)) {
      return errorResponse(400, 'type deve ser "diet" ou "workout"')
    }

    const weekDates = type === 'diet' ? getWeekDates(7) : getWeekDates(5)
    const prompt    = type === 'diet'
      ? buildDietPrompt(profile, moodAdjust, weekDates, String(previousFeedback))
      : buildWorkoutPrompt(profile, moodAdjust, weekDates, String(previousFeedback))

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:           'llama-3.3-70b-versatile',
        messages:        [{ role: 'user', content: prompt }],
        max_tokens:      4000,
        temperature:     0.6,
        response_format: { type: 'json_object' },
      }),
    })

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => '')
      console.error('Groq error:', groqRes.status, errText)
      return errorResponse(502, 'Geração de plano indisponível. Tente novamente.')
    }

    const groqData = await groqRes.json()
    const text     = groqData.choices?.[0]?.message?.content ?? '{}'

    let plan: { days?: Record<string, unknown>[] }
    try {
      plan = JSON.parse(text)
    } catch {
      return errorResponse(422, 'Erro ao gerar plano. Tente novamente.')
    }

    // ── Pós-processamento: garantir datas corretas e UUIDs reais ──────────
    if (Array.isArray(plan.days)) {
      plan.days = plan.days.map((day, i) => {
        // Sempre sobrescreve a data com a data real da semana atual
        const base = { ...day, date: weekDates[i] ?? day.date }

        if (type === 'workout') {
          return {
            ...base,
            id:        crypto.randomUUID(), // WorkoutSession.id obrigatório
            completed: false,
            blocks: Array.isArray(day.blocks)
              ? (day.blocks as Record<string, unknown>[]).map((block) => ({
                  ...block,
                  id: crypto.randomUUID(),
                  exercises: Array.isArray(block.exercises)
                    ? (block.exercises as Record<string, unknown>[]).map((ex) => ({
                        ...ex,
                        id:            crypto.randomUUID(),
                        completedSets: 0,
                      }))
                    : [],
                }))
              : [],
          }
        }

        // Para dieta: garantir IDs em foods
        if (type === 'diet' && Array.isArray(day.meals)) {
          return {
            ...base,
            meals: (day.meals as Record<string, unknown>[]).map((meal) => ({
              ...meal,
              foods: Array.isArray(meal.foods)
                ? (meal.foods as Record<string, unknown>[]).map((food) => ({
                    ...food,
                    id: food.id ?? crypto.randomUUID(),
                  }))
                : [],
            })),
          }
        }

        return base
      })
    }

    return new Response(JSON.stringify({ success: true, data: plan }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('generate-plan error:', err)
    return errorResponse(500, 'Erro interno.')
  }
})

function buildDietPrompt(p: Record<string, unknown>, moodAdjust: number, dates: string[], feedback: string) {
  const genderMap: Record<string, string> = { masc: 'homem', fem: 'mulher', neu: 'pessoa', skip: 'pessoa' }
  const goalMap:   Record<string, string> = {
    lose_weight:  'perda de peso (déficit calórico)',
    gain_muscle:  'ganho de massa muscular (superávit calórico)',
    maintain:     'manutenção do peso e saúde',
    performance:  'melhora de performance esportiva',
  }

  const budgetMap: Record<string, string> = {
    economico: 'ECONÔMICO — use apenas ingredientes baratos e acessíveis: arroz, feijão, frango, ovos, macarrão, batata, cebola, tomate. NUNCA sugira carnes nobres, salmão, atum fresco, quinoa, berries, suplementos ou ingredientes importados.',
    moderado:  'MODERADO — ingredientes do dia a dia com boa variedade: frango, carne moída, atum enlatado, ovos, legumes variados, frutas comuns. Evite ingredientes muito caros.',
    premium:   'SEM RESTRIÇÃO — pode usar qualquer ingrediente: carnes nobres, salmão, atum fresco, quinoa, frutas importadas, suplementos proteicos, ingredientes gourmet.',
  }

  const cookingMap: Record<string, string> = {
    rapido:    'RÁPIDO (menos de 20 min) — priorize receitas simples: ovos mexidos, frango na frigideira, saladas, vitaminas, iogurte com fruta, receitas de air fryer. EVITE preparações longas.',
    moderado:  'NORMAL (20–40 min) — receitas práticas mas com variedade: frango assado, arroz com legumes, sopas simples, massas.',
    elaborado: 'GOSTA DE COZINHAR — pode incluir receitas elaboradas: marmitas completas, pratos com marinada, preparações que exigem mais tempo.',
  }

  const budget   = budgetMap[(p.food_budget as string) ?? 'moderado'] ?? budgetMap.moderado
  const cooking  = cookingMap[(p.cooking_time as string) ?? 'moderado'] ?? cookingMap.moderado
  const likes    = (p.food_likes    as string)?.trim()
  const dislikes = (p.food_dislikes as string)?.trim()

  return `Você é nutricionista especializado em alimentação brasileira. Gere um plano alimentar para 7 dias.

Perfil:
- Gênero: ${genderMap[p.gender as string] ?? 'pessoa'}
- Objetivo: ${goalMap[p.goal as string] ?? p.goal}
- Perfil de treino: ${p.profile}
- Peso: ${p.weight}kg | Meta: ${p.target_weight}kg | Altura: ${p.height}cm | Idade: ${p.age}
- Nível de atividade: ${p.activity_level}
- Restrições alimentares: ${(p.restrictions as string[])?.join(', ') || 'nenhuma'}
${moodAdjust !== 0 ? `- Ajuste calórico por humor: ${moodAdjust > 0 ? '+' : ''}${moodAdjust} kcal` : ''}

REALIDADE ALIMENTAR DO USUÁRIO (SEGUIR OBRIGATORIAMENTE):
- Orçamento: ${budget}
- Tempo para cozinhar: ${cooking}
${likes    ? `- Alimentos que GOSTA e costuma comer: ${likes}` : ''}
${dislikes ? `- Alimentos que EVITA ou NÃO GOSTA: ${dislikes} — NÃO inclua esses alimentos em nenhum dia` : ''}

Use EXATAMENTE estas datas para os 7 dias, nesta ordem: ${dates.join(', ')}

Retorne um objeto JSON com a chave "days" contendo array de exatamente 7 objetos:
{
  "days": [
    {
      "date": "${dates[0]}",
      "targetMacros": {"calories": 2000, "protein": 150, "carbs": 200, "fat": 70, "fiber": 28},
      "meals": [
        {
          "type": "breakfast",
          "foods": [
            {"id": "f1", "name": "Aveia com banana", "quantity": 80, "unit": "g", "macros": {"calories": 320, "protein": 10, "carbs": 55, "fat": 6}}
          ],
          "totalMacros": {"calories": 320, "protein": 10, "carbs": 55, "fat": 6},
          "completed": false
        }
      ]
    }
  ]
}

Inclua breakfast, lunch, dinner e snack em cada dia. Priorize alimentos brasileiros. Varie os pratos ao longo da semana.${feedback ? `\n\nFeedback do usuário sobre a semana anterior:\n"${feedback}"` : ''}`
}

function buildWorkoutPrompt(p: Record<string, unknown>, moodAdjust: number, dates: string[], feedback: string) {
  const intensity = moodAdjust <= -100 ? 'MUITO REDUZIDA — usuário exausto: apenas mobilidade, alongamento ou caminhada leve, sem carga'
    : moodAdjust < 0   ? 'REDUZIDA — usuário cansado: reduza volume em 20%, cargas leves, sem falha muscular'
    : moodAdjust > 0   ? 'AUMENTADA — usuário energizado: adicione 1 série extra nos compostos, cargas acima do normal, pode incluir técnicas de intensidade'
    : 'normal'

  const profileMap: Record<string, string> = {
    escultura:  'hipertrofia e definição muscular',
    vitalidade: 'cardio e resistência',
    harmonia:   'bem-estar e mobilidade',
  }

  const level = (p.fitness_level as string) ?? 'beginner'
  const fitnessMap: Record<string, string> = {
    beginner: `INICIANTE NA ACADEMIA
  - Use equipamentos de academia: barras, halteres, máquinas e cabos. NUNCA use apenas exercícios com peso corporal (flexão, agachamento sem carga, etc.) como treino principal.
  - Exercícios base: agachamento livre com barra, supino reto, remada curvada, desenvolvimento com halteres, leg press, puxada frontal.
  - Volume: 4-5 exercícios no aquecimento + 5-6 exercícios no bloco principal + 2-3 no cooldown.
  - Séries/reps: 3-4 séries × 10-15 reps. Carga moderada com boa técnica.
  - Duração estimada: 60-70 minutos por sessão.`,
    intermediate: `INTERMEDIÁRIO NA ACADEMIA
  - Use barras, halteres, cabos e máquinas livremente. Variedade de ângulos e pegadas.
  - Exercícios: levantamento terra, supino inclinado, puxada frontal, desenvolvimento, agachamento búlgaro, rosca direta e alternada, tríceps coice, leg press 45°.
  - Volume: 3-4 exercícios de aquecimento + 6-8 exercícios no bloco principal + 2-3 no cooldown.
  - Séries/reps: 4-5 séries × 8-12 reps. Inclua pelo menos 1 exercício de isolamento por grupo muscular.
  - Duração estimada: 70-80 minutos por sessão.`,
    advanced: `AVANÇADO NA ACADEMIA
  - Periodização, drop sets, superséries, pré-exaustão. Use todos os equipamentos disponíveis.
  - Exercícios: terra sumô, agachamento frontal, supino declinado, crucifixo inclinado, remada unilateral, pullover, face pull, hack squat, sissy squat, spider curl.
  - Volume: 3-4 aquecimento + 7-9 exercícios no bloco principal (incluindo superséries) + 2-3 cooldown.
  - Séries/reps: 4-6 séries × 6-12 reps com técnicas de intensidade.
  - Duração estimada: 75-90 minutos por sessão.`,
  }
  const fitnessGuidelines = fitnessMap[level] ?? fitnessMap.beginner

  return `Você é personal trainer experiente. Gere um plano de treino COMPLETO e REALISTA para 5 dias (segunda a sexta) para um usuário que FREQUENTA ACADEMIA.

Perfil:
- Foco: ${profileMap[p.profile as string] ?? 'geral'}
- Objetivo: ${{ lose_weight: 'perda de peso', gain_muscle: 'ganho de massa muscular', maintain: 'manutenção', performance: 'performance esportiva' }[p.goal as string] ?? p.goal}
- Nível de atividade: ${p.activity_level}
- Experiência: ${fitnessGuidelines}
- Intensidade desta semana: ${intensity}

REGRAS OBRIGATÓRIAS DE VOLUME — violá-las invalida o plano:
1. O bloco principal DEVE ter no mínimo ${level === 'advanced' ? 7 : level === 'intermediate' ? 6 : 5} exercícios com equipamentos de academia.
2. NUNCA gere um treino com apenas 2-3 exercícios — isso não é um treino real.
3. Cada sessão deve ter estimatedDuration entre ${level === 'advanced' ? 75 : 60} e ${level === 'advanced' ? 90 : 75} minutos.
4. Use SEMPRE equipamentos: barras, halteres, cabos, máquinas, anilhas. Peso corporal só em aquecimento/cooldown.
5. Varie os grupos musculares ao longo da semana (ex: Peito+Tríceps / Costas+Bíceps / Pernas / Ombros / Full body).

Use EXATAMENTE estas datas para os 5 dias, nesta ordem: ${dates.join(', ')}

Retorne um objeto JSON com a chave "days" contendo array de exatamente 5 objetos:
{
  "days": [
    {
      "date": "${dates[0]}",
      "title": "Peito e Tríceps",
      "muscleGroups": ["chest", "triceps"],
      "estimatedCalories": 420,
      "estimatedDuration": 70,
      "completed": false,
      "blocks": [
        {
          "type": "warmup",
          "status": "fixed",
          "title": "Aquecimento",
          "durationMin": 10,
          "exercises": [
            {"name": "Esteira leve", "sets": 1, "reps": "10min", "weight": 0, "completedSets": 0, "tip": "Mantenha ritmo leve para elevar a frequência cardíaca sem cansar.", "searchName": "walking", "bodyPart": "cardio"},
            {"name": "Rotação de ombros", "sets": 2, "reps": "15", "weight": 0, "completedSets": 0, "tip": "Faça círculos amplos para frente e para trás, solte a articulação.", "searchName": "shoulder circles", "bodyPart": "shoulders"},
            {"name": "Flexão de braço leve", "sets": 2, "reps": "10", "weight": 0, "completedSets": 0, "tip": "Aquecimento apenas — ritmo controlado, sem forçar.", "searchName": "push up", "bodyPart": "chest"}
          ]
        },
        {
          "type": "main",
          "status": "fixed",
          "title": "Treino Principal",
          "durationMin": 50,
          "exercises": [
            {"name": "Supino reto com barra", "sets": 4, "reps": "8-10", "weight": 60, "completedSets": 0, "tip": "Pés no chão, escápulas retraídas. Desça a barra controladamente até o peito e empurre sem trancar os cotovelos.", "searchName": "barbell bench press", "bodyPart": "chest"},
            {"name": "Supino inclinado com halteres", "sets": 4, "reps": "10-12", "weight": 22, "completedSets": 0, "tip": "Banco a 30-45°, cotovelos a 45° do tronco. Controle a descida em 2 segundos.", "searchName": "incline dumbbell press", "bodyPart": "chest"},
            {"name": "Crucifixo no cabo", "sets": 3, "reps": "12-15", "weight": 12, "completedSets": 0, "tip": "Puxe os cabos em arco até o centro do peito, mantendo leve flexão nos cotovelos.", "searchName": "cable fly", "bodyPart": "chest"},
            {"name": "Tríceps pulley", "sets": 4, "reps": "12", "weight": 25, "completedSets": 0, "tip": "Cotovelos colados ao tronco. Empurre a corda até a extensão total e abra os punhos no final.", "searchName": "cable triceps pushdown", "bodyPart": "upper arms"},
            {"name": "Tríceps testa com barra EZ", "sets": 3, "reps": "10-12", "weight": 20, "completedSets": 0, "tip": "Deitado, desça a barra em direção à testa dobrando apenas os cotovelos, mantendo os braços perpendiculares.", "searchName": "ez bar skull crusher", "bodyPart": "upper arms"},
            {"name": "Mergulho entre bancos", "sets": 3, "reps": "12-15", "weight": 0, "completedSets": 0, "tip": "Dedos apontados para frente, desça até os cotovelos a 90° e empurre com o tríceps.", "searchName": "tricep dip", "bodyPart": "upper arms"}
          ]
        },
        {
          "type": "cooldown",
          "status": "fixed",
          "title": "Alongamento",
          "durationMin": 8,
          "exercises": [
            {"name": "Alongamento de peito", "sets": 1, "reps": "30s cada lado", "weight": 0, "completedSets": 0, "tip": "Apoie o braço numa coluna e gire o corpo para abrir o peito suavemente.", "searchName": "chest stretch", "bodyPart": "chest"},
            {"name": "Alongamento de tríceps", "sets": 1, "reps": "30s cada lado", "weight": 0, "completedSets": 0, "tip": "Braço dobrado atrás da cabeça, pressione suavemente com a outra mão.", "searchName": "tricep stretch", "bodyPart": "upper arms"}
          ]
        }
      ]
    }
  ]
}

Regras obrigatórias para cada exercício:
- "tip": 1 frase curta em português explicando como executar o movimento corretamente
- "searchName": nome do exercício em inglês técnico para busca no ExerciseDB (ex: "barbell bench press", "dumbbell curl", "cable row", "leg press", "lat pulldown")
- "bodyPart": grupo muscular principal em inglês, um destes valores exatos: chest, back, shoulders, upper arms, lower arms, upper legs, lower legs, waist, cardio, neck${feedback ? `\n\nFeedback do usuário sobre a semana anterior (leve em conta para este novo plano):\n"${feedback}"` : ''}`
}

function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
