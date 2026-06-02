/**
 * Edge Function: swap-item
 * Substitui uma refeição ou dia de treino do plano com base em um motivo do usuário.
 * Usa Groq para gerar o item substituto com o mesmo perfil calórico/estrutural.
 *
 * Deploy: supabase functions deploy swap-item
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GROQ_KEY      = Deno.env.get('GROQ_API_KEY') ?? ''
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!

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

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) return errRes(404, 'Perfil não encontrado')

    const { type, currentItem, reason, date } = await req.json()

    if (!['meal', 'workout'].includes(type)) return errRes(400, 'type inválido')
    if (!currentItem) return errRes(400, 'currentItem é obrigatório')
    if (!reason || typeof reason !== 'string') return errRes(400, 'reason é obrigatório')

    const prompt = type === 'meal'
      ? buildMealSwapPrompt(profile, currentItem, reason)
      : buildWorkoutSwapPrompt(profile, currentItem, reason, date)

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:           'llama-3.3-70b-versatile',
        messages:        [{ role: 'user', content: prompt }],
        max_tokens:      2000,
        temperature:     0.7,
        response_format: { type: 'json_object' },
      }),
    })

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => '')
      console.error('Groq swap error:', groqRes.status, errText)
      return errRes(502, 'Não foi possível gerar a substituição. Tente novamente.')
    }

    const groqData = await groqRes.json()
    const text = groqData.choices?.[0]?.message?.content ?? '{}'

    let result: Record<string, unknown>
    try {
      result = JSON.parse(text)
    } catch {
      return errRes(422, 'Erro ao processar substituição. Tente novamente.')
    }

    // ── Pós-processamento: garantir IDs reais ──────────────────────────────
    let newItem = result.newItem as Record<string, unknown> ?? result

    if (type === 'workout') {
      newItem = {
        ...newItem,
        id:        crypto.randomUUID(),
        date:      date ?? (currentItem as Record<string, unknown>).date,
        completed: false,
        blocks: Array.isArray(newItem.blocks)
          ? (newItem.blocks as Record<string, unknown>[]).map((block) => ({
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
    } else {
      // Garantir IDs nos foods
      if (Array.isArray(newItem.foods)) {
        newItem = {
          ...newItem,
          completed: false,
          foods: (newItem.foods as Record<string, unknown>[]).map((food) => ({
            ...food,
            id: food.id ?? crypto.randomUUID(),
          })),
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: { newItem } }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('swap-item error:', err)
    return errRes(500, 'Erro interno.')
  }
})

function buildMealSwapPrompt(
  profile: Record<string, unknown>,
  currentMeal: Record<string, unknown>,
  reason: string
) {
  const currentJson = JSON.stringify(currentMeal, null, 2)

  // Mesmos mapas de contexto do generate-plan — mantém consistência: a refeição
  // substituta respeita orçamento, tempo de preparo e gostos do usuário.
  const budgetMap: Record<string, string> = {
    economico: 'ECONÔMICO — apenas ingredientes simples e baratos do dia a dia brasileiro (arroz, feijão, frango, ovos, batata, banana). NUNCA carnes nobres, salmão, quinoa, castanhas importadas.',
    moderado:  'MODERADO — ingredientes comuns de supermercado (frango, carne moída, atum enlatado, ovos, batata doce, legumes comuns). Evite ingredientes exóticos.',
    premium:   'SEM RESTRIÇÃO — pode usar ingredientes nobres (salmão, filé, quinoa, whey, castanhas).',
  }
  const cookingMap: Record<string, string> = {
    rapido:    'RÁPIDO (menos de 20 min) — preparo simples, sem receitas elaboradas.',
    moderado:  'NORMAL (20–40 min) — receitas práticas do cotidiano.',
    elaborado: 'GOSTA DE COZINHAR — pode incluir receitas mais elaboradas.',
  }
  const budget   = budgetMap[(profile.food_budget as string) ?? 'moderado'] ?? budgetMap.moderado
  const cooking  = cookingMap[(profile.cooking_time as string) ?? 'moderado'] ?? cookingMap.moderado
  const likes    = (profile.food_likes    as string)?.trim()
  const dislikes = (profile.food_dislikes as string)?.trim()

  return `Você é nutricionista especializado em alimentação brasileira.

O usuário quer substituir esta refeição:
${currentJson}

Motivo da substituição: "${reason}"

Perfil do usuário:
- Objetivo: ${profile.goal}
- Peso: ${profile.weight}kg | Altura: ${profile.height}cm
- Restrições alimentares: ${(profile.restrictions as string[])?.join(', ') || 'nenhuma'}

REALIDADE ALIMENTAR (SEGUIR OBRIGATORIAMENTE):
- Orçamento: ${budget}
- Tempo para cozinhar: ${cooking}
${likes    ? `- Alimentos que GOSTA: ${likes}` : ''}
${dislikes ? `- Alimentos que EVITA — NÃO inclua: ${dislikes}` : ''}

Antes de gerar o JSON, raciocine internamente (NÃO escreva esse raciocínio na resposta):
1. Quais macros a refeição original tem? A substituta deve ficar dentro de ±15%.
2. O motivo "${reason}" pede o quê? (mais leve, sem um ingrediente, mais prático...)
3. A substituta respeita orçamento, tempo de preparo e os alimentos evitados?
Depois gere APENAS o JSON final.

Use nomes ESPECÍFICOS de alimentos brasileiros (ex: "Frango grelhado", nunca "proteína magra").

Retorne um objeto JSON com exatamente esta estrutura:
{
  "newItem": {
    "type": "${currentMeal.type ?? 'lunch'}",
    "foods": [
      {
        "id": "f1",
        "name": "Nome do alimento",
        "quantity": 150,
        "unit": "g",
        "macros": {"calories": 300, "protein": 25, "carbs": 20, "fat": 10}
      }
    ],
    "totalMacros": {"calories": 450, "protein": 35, "carbs": 40, "fat": 15},
    "completed": false
  }
}`
}

function buildWorkoutSwapPrompt(
  profile: Record<string, unknown>,
  currentWorkout: Record<string, unknown>,
  reason: string,
  date: string
) {
  const profileMap: Record<string, string> = {
    escultura:  'hipertrofia e definição muscular',
    vitalidade: 'cardio e resistência',
    harmonia:   'bem-estar e mobilidade',
  }
  const level = (profile.fitness_level as string) ?? 'beginner'
  const fitnessMap: Record<string, string> = {
    beginner:     'INICIANTE NA ACADEMIA — 3-4 séries × 10-15 reps. Use barras, halteres e máquinas básicas. Mínimo 5 exercícios no bloco principal.',
    intermediate: 'INTERMEDIÁRIO — 4-5 séries × 8-12 reps. Movimentos compostos + isolados. Mínimo 6 exercícios no bloco principal.',
    advanced:     'AVANÇADO — 4-6 séries × 6-12 reps. Técnicas de intensidade permitidas. Mínimo 7 exercícios no bloco principal.',
  }
  const fitnessGuidelines = fitnessMap[level] ?? fitnessMap.beginner

  return `Você é personal trainer experiente. O usuário FREQUENTA ACADEMIA e precisa de um treino substituto completo e realista.

Treino original a substituir (dia ${date}):
"${currentWorkout.title}" — ${currentWorkout.estimatedDuration} min

Motivo da substituição: "${reason}"

Perfil do usuário:
- Foco: ${profileMap[profile.profile as string] ?? 'geral'}
- Objetivo: ${profile.goal}
- Nível de atividade: ${profile.activity_level}
- Experiência: ${fitnessGuidelines}

REGRAS OBRIGATÓRIAS:
1. Se o motivo mencionar "sem academia" ou "em casa", use peso corporal. Caso contrário, use SEMPRE equipamentos (barras, halteres, cabos, máquinas).
2. O bloco principal DEVE ter no mínimo ${level === 'advanced' ? 7 : level === 'intermediate' ? 6 : 5} exercícios — NUNCA menos.
3. Se for "dor muscular", foque em grupos diferentes ou faça mobilidade/cardio.
4. Mantenha duração similar ao original (~${currentWorkout.estimatedDuration} min).

Antes de gerar o JSON, raciocine internamente (NÃO escreva esse raciocínio na resposta):
1. O motivo "${reason}" pede o quê? (sem equipamento, menos tempo, dor muscular, mais intensidade...)
2. Que grupos musculares fazem sentido dado o motivo e o foco do usuário?
3. O bloco principal atinge o mínimo de exercícios do nível e a duração bate com o original?
Depois gere APENAS o JSON final.

Regras obrigatórias para cada exercício:
- "tip": 1 frase curta em português explicando como executar o movimento corretamente
- "searchName": nome em inglês técnico para ExerciseDB (ex: "barbell bench press", "lat pulldown", "leg press")
- "bodyPart": um destes valores exatos: chest, back, shoulders, upper arms, lower arms, upper legs, lower legs, waist, cardio, neck

Retorne um objeto JSON com exatamente esta estrutura:
{
  "newItem": {
    "date": "${date}",
    "title": "Nome do treino",
    "muscleGroups": ["chest", "triceps"],
    "estimatedCalories": 380,
    "estimatedDuration": ${currentWorkout.estimatedDuration ?? 65},
    "completed": false,
    "blocks": [
      {
        "type": "warmup",
        "status": "fixed",
        "title": "Aquecimento",
        "durationMin": 10,
        "exercises": [
          {"name": "Esteira leve", "sets": 1, "reps": "8min", "weight": 0, "completedSets": 0, "tip": "Ritmo leve para elevar frequência cardíaca.", "searchName": "walking", "bodyPart": "cardio"},
          {"name": "Rotação de ombros", "sets": 2, "reps": "15", "weight": 0, "completedSets": 0, "tip": "Círculos amplos para frente e para trás.", "searchName": "shoulder circles", "bodyPart": "shoulders"}
        ]
      },
      {
        "type": "main",
        "status": "ai_added",
        "title": "Treino Principal",
        "durationMin": ${Math.max((currentWorkout.estimatedDuration as number ?? 65) - 18, 40)},
        "exercises": [
          {"name": "Supino reto com barra", "sets": 4, "reps": "8-10", "weight": 60, "completedSets": 0, "tip": "Pés no chão, desça a barra controladamente até o peito.", "searchName": "barbell bench press", "bodyPart": "chest"},
          {"name": "Supino inclinado com halteres", "sets": 4, "reps": "10-12", "weight": 22, "completedSets": 0, "tip": "Banco a 45°, cotovelos a 45° do tronco.", "searchName": "incline dumbbell press", "bodyPart": "chest"},
          {"name": "Crucifixo no cabo", "sets": 3, "reps": "12-15", "weight": 10, "completedSets": 0, "tip": "Puxe em arco mantendo leve flexão nos cotovelos.", "searchName": "cable fly", "bodyPart": "chest"},
          {"name": "Tríceps pulley", "sets": 4, "reps": "12", "weight": 25, "completedSets": 0, "tip": "Cotovelos colados ao tronco, estenda totalmente.", "searchName": "cable triceps pushdown", "bodyPart": "upper arms"},
          {"name": "Tríceps testa", "sets": 3, "reps": "10-12", "weight": 20, "completedSets": 0, "tip": "Desça a barra em direção à testa dobrando apenas os cotovelos.", "searchName": "ez bar skull crusher", "bodyPart": "upper arms"}
        ]
      },
      {
        "type": "cooldown",
        "status": "fixed",
        "title": "Alongamento",
        "durationMin": 8,
        "exercises": [
          {"name": "Alongamento de peito", "sets": 1, "reps": "30s", "weight": 0, "completedSets": 0, "tip": "Apoie o braço numa coluna e gire o corpo.", "searchName": "chest stretch", "bodyPart": "chest"}
        ]
      }
    ]
  }
}`
}

function errRes(status: number, message: string) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...cors, 'Content-Type': 'application/json' } }
  )
}
