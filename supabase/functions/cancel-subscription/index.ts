/**
 * Edge Function: cancel-subscription
 * Cancela o acesso Premium do usuário.
 *
 * Para assinaturas recorrentes (plano mensal):
 *   1. Cancela o preapproval no Mercado Pago (para cobranças futuras)
 *   2. Revoga o acesso no banco imediatamente
 *
 * Para pagamentos únicos (plano anual):
 *   Apenas revoga o acesso no banco.
 *
 * Deploy: supabase functions deploy cancel-subscription
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MP_TOKEN         = Deno.env.get('MP_ACCESS_TOKEN') ?? ''
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON    = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    // ─── Autenticação ────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return errRes(401, 'Não autorizado')

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return errRes(401, 'Token inválido')

    // ─── Verificar premium e obter dados da assinatura ────────────────
    const { data: profile } = await supabase
      .from('users')
      .select('is_premium, premium_expires_at, premium_plan, mp_subscription_id, subscription_type')
      .eq('id', user.id)
      .single()

    if (!profile?.is_premium) {
      return errRes(400, 'Sua conta não possui assinatura Premium ativa.')
    }

    // ─── Cancelar no Mercado Pago (somente assinaturas recorrentes) ───
    if (
      profile.subscription_type === 'recurring' &&
      profile.mp_subscription_id &&
      MP_TOKEN
    ) {
      const mpRes = await fetch(
        `https://api.mercadopago.com/preapproval/${profile.mp_subscription_id}`,
        {
          method:  'PUT',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${MP_TOKEN}`,
          },
          body: JSON.stringify({ status: 'cancelled' }),
        }
      )

      if (mpRes.ok) {
        console.log(`✅ Preapproval ${profile.mp_subscription_id} cancelado no Mercado Pago`)
      } else {
        // Falha no MP não impede o cancelamento no banco — registra e segue
        const errText = await mpRes.text()
        console.error('⚠️ Erro ao cancelar preapproval no MP:', mpRes.status, errText)
      }
    }

    // ─── Revogar acesso no banco (service_role bypassa RLS) ──────────
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE)
    const now = new Date().toISOString()

    const { error: updateError } = await adminClient
      .from('users')
      .update({
        is_premium:           false,
        premium_cancelled_at: now,
        premium_expires_at:   now,   // encerra o acesso imediatamente
        updated_at:           now,
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Erro ao cancelar premium:', updateError)
      return errRes(500, 'Não foi possível cancelar. Tente novamente ou contate o suporte.')
    }

    console.log(`✅ Premium cancelado — usuário ${user.id} | plano: ${profile.premium_plan} | tipo: ${profile.subscription_type}`)

    return new Response(
      JSON.stringify({ success: true, message: 'Assinatura cancelada com sucesso.' }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('cancel-subscription error:', err)
    return errRes(500, 'Erro interno. Tente novamente.')
  }
})

function errRes(status: number, message: string) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...cors, 'Content-Type': 'application/json' } }
  )
}
