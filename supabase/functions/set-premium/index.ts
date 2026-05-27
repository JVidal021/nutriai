/**
 * Edge Function: set-premium
 * Webhook chamado pelo Mercado Pago. Trata dois tipos:
 *
 *   1. subscription_preapproval  → plano mensal autorizado (ativa premium + armazena preapproval_id)
 *   2. payment                   → pagamento aprovado
 *        • com subscription_id   → renovação mensal (estende premium_expires_at)
 *        • sem subscription_id   → pagamento único anual (ativa premium por 1 ano)
 *
 * Deploy: supabase functions deploy set-premium
 * Segurança: verifica status diretamente na API do MP (nunca confia só no webhook)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MP_TOKEN         = Deno.env.get('MP_ACCESS_TOKEN') ?? ''
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'content-type, x-signature, x-request-id',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  if (!MP_TOKEN) {
    console.error('MP_ACCESS_TOKEN não configurado')
    return new Response('error', { status: 503, headers: cors })
  }

  try {
    const body = await req.json()
    console.log('Webhook recebido:', JSON.stringify(body))

    const { type, data } = body
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)
    const now = new Date().toISOString()

    // ═══════════════════════════════════════════════════════════════════
    // 1. ASSINATURA MENSAL — autorização / cancelamento
    // ═══════════════════════════════════════════════════════════════════
    if (type === 'subscription_preapproval') {
      const preapprovalId = data?.id
      if (!preapprovalId) return new Response('ok', { headers: cors })

      // Verificar na API do MP
      const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
        headers: { 'Authorization': `Bearer ${MP_TOKEN}` },
      })
      if (!mpRes.ok) {
        console.error('Erro ao verificar preapproval:', mpRes.status)
        return new Response('error', { status: 500, headers: cors })
      }
      const preapproval = await mpRes.json()
      console.log('Preapproval status:', preapproval.status, '| ref:', preapproval.external_reference)

      const [userId] = (preapproval.external_reference ?? '').split('|')
      if (!userId) return new Response('ok', { headers: cors })

      // Cancelamento / pausa → desativar premium
      if (preapproval.status === 'cancelled' || preapproval.status === 'paused') {
        await supabase.from('users').update({
          is_premium:           false,
          premium_cancelled_at: now,
          premium_expires_at:   now,
          updated_at:           now,
        }).eq('id', userId)
        console.log(`⛔ Preapproval ${preapproval.status} — premium desativado para ${userId}`)
        return new Response('ok', { headers: cors })
      }

      // Só prosseguir se autorizado
      if (preapproval.status !== 'authorized') {
        return new Response('ok', { headers: cors })
      }

      // Idempotência: evitar dupla ativação
      const { data: already } = await supabase
        .from('users').select('id').eq('mp_subscription_id', preapprovalId).single()
      if (already) {
        console.log('Preapproval já processado:', preapprovalId)
        return new Response('ok', { headers: cors })
      }

      const expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + 1)

      const { error: updateErr } = await supabase.from('users').update({
        is_premium:           true,
        premium_plan:         'monthly',
        subscription_type:    'recurring',
        mp_subscription_id:   preapprovalId,
        premium_expires_at:   expiresAt.toISOString(),
        premium_activated_at: now,
        premium_cancelled_at: null,
        updated_at:           now,
      }).eq('id', userId)

      if (updateErr) {
        console.error('Erro ao ativar premium (preapproval):', updateErr)
        return new Response('error', { status: 500, headers: cors })
      }
      console.log(`✅ Premium mensal ativado para ${userId} — expira ${expiresAt.toISOString()}`)
      return new Response(JSON.stringify({ success: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // ═══════════════════════════════════════════════════════════════════
    // 2. PAGAMENTO — único (anual) ou renovação (mensal recorrente)
    // ═══════════════════════════════════════════════════════════════════
    if (type === 'payment') {
      const paymentId = data?.id
      if (!paymentId) return new Response('ok', { headers: cors })

      // Verificar na API do MP
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${MP_TOKEN}` },
      })
      if (!mpRes.ok) {
        console.error('Erro ao verificar pagamento:', mpRes.status)
        return new Response('error', { status: 500, headers: cors })
      }
      const payment = await mpRes.json()
      console.log('Payment status:', payment.status, '| subscription_id:', payment.subscription_id ?? 'none')

      if (payment.status !== 'approved') {
        console.log('Pagamento não aprovado:', payment.status)
        return new Response('ok', { headers: cors })
      }

      // Idempotência
      const { data: existingPay } = await supabase
        .from('payments').select('id').eq('mp_payment_id', String(paymentId)).single()
      if (existingPay) {
        console.log('Pagamento já processado:', paymentId)
        return new Response('ok', { headers: cors })
      }

      let userId: string
      let plan: string
      const expiresAt = new Date()

      // ── Renovação de assinatura mensal ─────────────────────────────
      if (payment.subscription_id) {
        const { data: userRow } = await supabase
          .from('users')
          .select('id, premium_expires_at')
          .eq('mp_subscription_id', payment.subscription_id)
          .single()

        if (!userRow) {
          console.warn('Usuário não encontrado para subscription_id:', payment.subscription_id)
          return new Response('ok', { headers: cors })
        }

        userId = userRow.id
        plan   = 'monthly'

        // Estender a partir da expiração atual (não de hoje, evita sobreposição)
        const currentExpiry = userRow.premium_expires_at
          ? new Date(userRow.premium_expires_at)
          : new Date()
        const base = currentExpiry > new Date() ? currentExpiry : new Date()
        expiresAt.setTime(base.getTime())
        expiresAt.setMonth(expiresAt.getMonth() + 1)

        await supabase.from('users').update({
          is_premium:         true,
          premium_expires_at: expiresAt.toISOString(),
          updated_at:         now,
        }).eq('id', userId)

        console.log(`🔄 Premium renovado para ${userId} — nova expiração: ${expiresAt.toISOString()}`)

      // ── Pagamento único anual ───────────────────────────────────────
      } else {
        const externalRef = payment.external_reference ?? ''
        const parts = externalRef.split('|')
        userId = parts[0]
        plan   = parts[1] ?? 'annual'

        if (!userId) {
          console.error('external_reference inválido:', externalRef)
          return new Response('error', { status: 400, headers: cors })
        }

        expiresAt.setFullYear(expiresAt.getFullYear() + 1)

        const { error: updateErr } = await supabase.from('users').update({
          is_premium:           true,
          premium_plan:         'annual',
          subscription_type:    'one_time',
          premium_expires_at:   expiresAt.toISOString(),
          premium_activated_at: now,
          premium_cancelled_at: null,
          updated_at:           now,
        }).eq('id', userId)

        if (updateErr) {
          console.error('Erro ao ativar premium (anual):', updateErr)
          return new Response('error', { status: 500, headers: cors })
        }
        console.log(`✅ Premium anual ativado para ${userId} — expira ${expiresAt.toISOString()}`)
      }

      // Registrar pagamento para auditoria
      await supabase.from('payments').insert({
        user_id:       userId,
        mp_payment_id: String(paymentId),
        plan,
        amount:        payment.transaction_amount,
        currency:      payment.currency_id,
        status:        'approved',
        paid_at:       payment.date_approved ?? now,
        expires_at:    expiresAt.toISOString(),
      })

      return new Response(JSON.stringify({ success: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // Outros tipos de webhook — ignorar silenciosamente
    console.log('Webhook ignorado (tipo não tratado):', type)
    return new Response('ok', { headers: cors })

  } catch (err) {
    console.error('set-premium error:', err)
    return new Response('error', { status: 500, headers: cors })
  }
})
