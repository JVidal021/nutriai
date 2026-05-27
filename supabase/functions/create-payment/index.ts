/**
 * Edge Function: create-payment
 * Plano mensal  → Mercado Pago Preapproval API  (assinatura recorrente, R$29/mês)
 * Plano anual   → Mercado Pago Preference API   (pagamento único, R$209)
 *
 * Deploy: supabase functions deploy create-payment
 * Secrets: supabase secrets set MP_ACCESS_TOKEN=seu_token
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MP_TOKEN      = Deno.env.get('MP_ACCESS_TOKEN') ?? ''
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const APP_URL       = Deno.env.get('APP_URL') ?? 'https://nutriai.app'

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (!MP_TOKEN) return errRes(503, 'Serviço de pagamento temporariamente indisponível.')

  try {
    // ─── Autenticação ─────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return errRes(401, 'Não autorizado')

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return errRes(401, 'Token inválido')

    const { data: profile } = await supabase
      .from('users').select('is_premium, email').eq('id', user.id).single()
    if (profile?.is_premium) return errRes(400, 'Você já possui uma assinatura Premium ativa!')

    const { plan } = await req.json()
    if (plan !== 'monthly' && plan !== 'annual') return errRes(400, 'Plano inválido')

    const payerEmail   = profile?.email ?? user.email ?? ''
    const externalRef  = `${user.id}|${plan}|${Date.now()}`
    const notifyUrl    = `${SUPABASE_URL}/functions/v1/set-premium`

    // ─── Plano Mensal → Preapproval (recorrente) ──────────────────────
    if (plan === 'monthly') {
      const payload = {
        payer_email:        payerEmail,
        reason:             'NutriAI Premium — Mensal',
        external_reference: externalRef,
        back_url:           'nutriai://pagamento/sucesso',
        auto_recurring: {
          frequency:          1,
          frequency_type:     'months',
          transaction_amount: 29.00,
          currency_id:        'BRL',
        },
        notification_url: notifyUrl,
        status:           'pending',
      }

      const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MP_TOKEN}` },
        body:    JSON.stringify(payload),
      })

      if (!mpRes.ok) {
        const errText = await mpRes.text()
        console.error('MP preapproval error:', mpRes.status, errText)
        return errRes(502, 'Erro ao criar assinatura recorrente. Tente novamente.')
      }

      const mpData = await mpRes.json()
      console.log(`Preapproval criado: ${mpData.id}`)

      return new Response(JSON.stringify({
        success:    true,
        init_point: mpData.init_point,
        id:         mpData.id,
        plan:       'monthly',
        type:       'recurring',
      }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // ─── Plano Anual → Preference (pagamento único) ───────────────────
    const payload = {
      items: [{
        id:          'nutriai-annual',
        title:       'NutriAI Premium — Anual',
        description: 'Acesso completo ao NutriAI Premium por 12 meses',
        quantity:    1,
        currency_id: 'BRL',
        unit_price:  209.00,
      }],
      payer:              { email: payerEmail },
      external_reference: externalRef,
      back_urls: {
        success: `nutriai://pagamento/sucesso`,
        failure: `nutriai://pagamento/falha`,
        pending: `nutriai://pagamento/pendente`,
      },
      auto_return:          'approved',
      notification_url:     notifyUrl,
      statement_descriptor: 'NUTRIAI APP',
      expires:              false,
    }

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MP_TOKEN}` },
      body:    JSON.stringify(payload),
    })

    if (!mpRes.ok) {
      const errText = await mpRes.text()
      console.error('MP preference error:', mpRes.status, errText)
      return errRes(502, 'Erro ao criar pagamento. Tente novamente.')
    }

    const mpData = await mpRes.json()
    console.log(`Preference criada: ${mpData.id}`)

    return new Response(JSON.stringify({
      success:     true,
      init_point:  mpData.init_point,
      sandbox_url: mpData.sandbox_init_point,
      id:          mpData.id,
      plan:        'annual',
      type:        'one_time',
    }), { headers: { ...cors, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('create-payment error:', err)
    return errRes(500, 'Erro interno')
  }
})

function errRes(status: number, message: string) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...cors, 'Content-Type': 'application/json' } }
  )
}
