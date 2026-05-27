import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, Linking,
} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@constants/index'
import { useUserStore } from '@store/index'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@services/supabase'

const FEATURES_FREE = [
  { label: '3 análises de foto por dia',    ok: true  },
  { label: 'Diário de calorias básico',      ok: true  },
  { label: '5 mensagens Coach IA / dia',     ok: true  },
  { label: 'Rastreamento de hidratação',     ok: true  },
  { label: 'Progresso e streaks',            ok: true  },
  { label: 'Dieta personalizada por IA',     ok: false },
  { label: 'Treinos gerados por IA',         ok: false },
  { label: 'Guia de exercícios completo',    ok: false },
  { label: 'Relatório semanal detalhado',    ok: false },
  { label: 'Ranks, Co-op e Otimização',      ok: false },
]

const FEATURES_PREMIUM = [
  { label: 'Fotos ilimitadas por dia',        ok: true },
  { label: 'Dieta personalizada por IA',      ok: true },
  { label: 'Treinos gerados por IA',          ok: true },
  { label: 'Guia de exercícios completo',     ok: true },
  { label: 'Coach IA ilimitado',              ok: true },
  { label: 'Relatório semanal detalhado',     ok: true },
  { label: 'Sistema de ranks completo',       ok: true },
  { label: 'Modo Co-op e desafios',           ok: true },
  { label: 'Painel de otimização metabólica', ok: true },
]

function formatDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets()
  const [billing,    setBilling]    = useState<'monthly' | 'annual'>('monthly')
  const [loading,    setLoading]    = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const { user, updateUser, isLoading } = useUserStore()

  if (isLoading || !user) return null

  const isTrial      = user.premiumPlan === 'trial'
  const isRecurring  = user.subscriptionType === 'recurring'
  const planLabel    = isTrial ? 'Trial' : user.premiumPlan === 'annual' ? 'Anual' : user.premiumPlan === 'monthly' ? 'Mensal' : '—'
  const billingLabel = isTrial ? 'Período de teste gratuito' : isRecurring ? 'Renovação automática mensal' : 'Pagamento único · 12 meses'
  const expiryLabel  = isTrial ? 'Trial expira em:' : isRecurring ? 'Próxima cobrança:' : 'Válido até:'

  const trialDaysLeft = isTrial && user.premiumExpiresAt
    ? Math.max(0, Math.ceil((new Date(user.premiumExpiresAt).getTime() - Date.now()) / 86_400_000))
    : 0

  const handleSubscribe = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { Alert.alert('Erro', 'Faça login antes de assinar.'); return }

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-payment`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body:    JSON.stringify({ plan: billing }),
        }
      )
      const data = await res.json()
      if (!data.success || !data.init_point) throw new Error(data.error ?? 'Erro ao criar pagamento')

      // Abre o checkout do Mercado Pago em navegador in-app.
      // Quando o MP redireciona para nutriai://, o navegador fecha automaticamente.
      const result = await WebBrowser.openAuthSessionAsync(
        data.init_point,
        'nutriai://'
      )

      // Verifica o status assim que o usuário volta — seja por redirect ou fechando manualmente
      if (result.type === 'success') {
        // Redirect detectado → quase certo que pagou, verifica já
        await handleCheckStatus(true)
      } else {
        // Fechou manualmente → pode ter pago, oferece verificação gentil
        Alert.alert(
          'Verificar pagamento',
          'Caso tenha concluído o pagamento, toque em "Verificar status" para ativar o Premium.',
          [
            { text: 'Agora não', style: 'cancel' },
            { text: 'Verificar', onPress: () => handleCheckStatus(false) },
          ]
        )
      }
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    const msg = isRecurring
      ? 'A cobrança automática será cancelada e seu acesso Premium será encerrado imediatamente.'
      : 'Seu acesso Premium será encerrado imediatamente. O valor já pago não é reembolsável.'

    Alert.alert(
      'Cancelar assinatura Premium',
      `${msg}\n\nEssa ação não pode ser desfeita. Deseja continuar?`,
      [
        { text: 'Voltar', style: 'cancel' },
        { text: 'Cancelar assinatura', style: 'destructive', onPress: confirmCancel },
      ]
    )
  }

  const confirmCancel = async () => {
    setCancelling(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { Alert.alert('Erro', 'Sessão expirada. Faça login novamente.'); return }

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/cancel-subscription`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        }
      )
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Erro ao cancelar')

      updateUser({
        isPremium:        false,
        premiumPlan:      undefined,
        subscriptionType: undefined,
        mpSubscriptionId: undefined,
        premiumExpiresAt: undefined,
      })

      Alert.alert(
        '✓ Assinatura cancelada',
        'Seu acesso Premium foi encerrado. Esperamos te ver de volta em breve!\n\nSe tiver algum problema, contate suporte.nutriai@outlook.com.',
        [{ text: 'Ok' }]
      )
    } catch (err) {
      Alert.alert(
        'Erro ao cancelar',
        err instanceof Error ? err.message : 'Não foi possível cancelar. Tente novamente ou contate suporte.nutriai@outlook.com.'
      )
    } finally {
      setCancelling(false)
    }
  }

  // silent=true → chamado automaticamente após redirect (não mostra alert de "pendente")
  const handleCheckStatus = async (silent = false) => {
    setLoading(true)
    try {
      // Aguarda 2s para o webhook do MP processar antes de consultar
      if (silent) await new Promise(r => setTimeout(r, 2000))

      const { data } = await supabase
        .from('users')
        .select('is_premium, premium_expires_at, premium_plan, subscription_type, mp_subscription_id')
        .eq('id', user?.id ?? '')
        .single()

      if (data?.is_premium) {
        updateUser({
          isPremium:        true,
          premiumExpiresAt: data.premium_expires_at ?? undefined,
          premiumPlan:      data.premium_plan ?? undefined,
          subscriptionType: data.subscription_type ?? undefined,
          mpSubscriptionId: data.mp_subscription_id ?? undefined,
        })
        Alert.alert('✅ Premium ativo!', 'Sua assinatura foi confirmada. Bem-vinde ao Premium! 🎉')
      } else if (!silent) {
        Alert.alert(
          'Pagamento pendente',
          'Não encontramos pagamento aprovado ainda.\n\nAguarde alguns instantes e tente novamente.'
        )
      } else {
        // Silent e ainda não aprovado — pode ter sido muito rápido, informa sem travar
        Alert.alert(
          'Processando pagamento…',
          'O pagamento ainda está sendo confirmado. Aguarde um momento e toque em "Verificar status".',
          [{ text: 'Ok' }]
        )
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível verificar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>

      {/* Botão de Fechar */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
          <Text style={s.closeBtnText}>✕ Fechar</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.title}>👑 NutriAI Premium</Text>
      <Text style={s.sub}>Desbloqueie seu potencial completo</Text>

      {/* Banner de vantagem — adapta conforme plano selecionado */}
      <View style={s.advantageBanner}>
        <Text style={s.advIcon}>{billing === 'monthly' ? '🔄' : '🎯'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.advTitle}>
            {billing === 'monthly'
              ? 'Assinatura mensal · cancele quando quiser'
              : 'Pagamento único · acesso por 12 meses'}
          </Text>
          <Text style={s.advSub}>
            {billing === 'monthly'
              ? 'Cobrança automática de R$29/mês via Mercado Pago. Sem fidelidade.'
              : 'Pague R$209 uma vez e tenha 1 ano completo de acesso Premium.'}
          </Text>
        </View>
      </View>

      {/* Toggle mensal / anual */}
      <View style={s.toggleWrap}>
        <TouchableOpacity style={[s.toggleOpt, billing === 'monthly' && s.toggleOptOn]} onPress={() => setBilling('monthly')}>
          <Text style={[s.toggleText, billing === 'monthly' && s.toggleTextOn]}>Mensal</Text>
          <View style={s.recurringPill}><Text style={s.recurringText}>Auto</Text></View>
        </TouchableOpacity>
        <TouchableOpacity style={[s.toggleOpt, billing === 'annual' && s.toggleOptOn]} onPress={() => setBilling('annual')}>
          <Text style={[s.toggleText, billing === 'annual' && s.toggleTextOn]}>Anual</Text>
          <View style={s.savePill}><Text style={s.saveText}>−40%</Text></View>
        </TouchableOpacity>
      </View>

      {/* Cards de planos */}
      <View style={s.plansRow}>
        <View style={s.planCard}>
          <Text style={s.planName}>Grátis</Text>
          <Text style={s.planPrice}>R$0</Text>
          <Text style={s.planPer}>para sempre</Text>
          <View style={s.divider} />
          {FEATURES_FREE.map(f => (
            <View key={f.label} style={s.featureRow}>
              <View style={[s.featureCheck, !f.ok && s.featureCheckNo]}>
                <Text style={{ fontSize: 10, color: f.ok ? Colors.accent : Colors.text3 }}>{f.ok ? '✓' : '✕'}</Text>
              </View>
              <Text style={[s.featureText, !f.ok && s.featureDisabled]}>{f.label}</Text>
            </View>
          ))}
        </View>

        <View style={[s.planCard, s.planCardFeatured]}>
          <View style={s.popularBadge}><Text style={s.popularText}>Recomendado</Text></View>
          <Text style={s.planName}>Premium</Text>
          <Text style={[s.planPrice, { color: Colors.accent }]}>{billing === 'annual' ? 'R$17' : 'R$29'}</Text>
          <Text style={s.planPer}>{billing === 'annual' ? '/mês · R$209/ano' : '/mês · renovação automática'}</Text>
          <View style={s.divider} />
          {FEATURES_PREMIUM.map(f => (
            <View key={f.label} style={s.featureRow}>
              <View style={s.featureCheck}><Text style={{ fontSize: 10, color: Colors.accent }}>✓</Text></View>
              <Text style={s.featureText}>{f.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Área Premium ativa ──────────────────────────────────────── */}
      {user?.isPremium ? (
        <View style={s.manageCard}>
          {/* Banner de status */}
          <View style={[s.activeBanner, isTrial && s.trialBanner]}>
            <Text style={s.activeEmoji}>{isTrial ? '🎁' : '👑'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.activeTitle, isTrial && s.trialTitle]}>
                {isTrial ? `Trial Premium ativo · ${trialDaysLeft} dia${trialDaysLeft !== 1 ? 's' : ''} restante${trialDaysLeft !== 1 ? 's' : ''}` : `Premium ativo · ${planLabel}`}
              </Text>
              <Text style={s.activeSub}>{billingLabel}</Text>
            </View>
          </View>

          {/* Banner de upgrade para usuários em trial */}
          {isTrial && (
            <TouchableOpacity
              style={s.upgradeTrialBanner}
              onPress={() => setBilling('monthly')}
              activeOpacity={0.8}
            >
              <Text style={s.upgradeTrialText}>
                ⚡ Assine agora para não perder o acesso ao fim do trial
              </Text>
            </TouchableOpacity>
          )}

          {/* Info da expiração */}
          {user.premiumExpiresAt && (
            <View style={s.expiryRow}>
              <Text style={s.expiryLabel}>{expiryLabel}</Text>
              <Text style={s.expiryDate}>{formatDate(user.premiumExpiresAt)}</Text>
            </View>
          )}

          {/* Ações */}
          <View style={s.manageActions}>
            {isTrial ? (
              <TouchableOpacity
                style={[s.cancelBtn, { borderColor: Colors.border2 }]}
                onPress={() => {
                  updateUser({
                    isPremium:        false,
                    premiumPlan:      undefined,
                    subscriptionType: undefined,
                    premiumExpiresAt: undefined,
                  })
                  supabase.from('users').update({
                    is_premium:         false,
                    premium_plan:       null,
                    subscription_type:  null,
                    premium_expires_at: null,
                    updated_at:         new Date().toISOString(),
                  }).eq('id', user.id)
                }}
              >
                <Text style={[s.cancelBtnText, { color: Colors.text3 }]}>Encerrar trial</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.cancelBtn, cancelling && { opacity: 0.6 }]}
                onPress={handleCancel}
                disabled={cancelling}
              >
                {cancelling
                  ? <ActivityIndicator size="small" color="#ff4444" />
                  : <Text style={s.cancelBtnText}>Cancelar assinatura</Text>
                }
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={s.supportBtn}
              onPress={() => Linking.openURL('mailto:suporte.nutriai@outlook.com?subject=Problema com assinatura NutriAI')}
            >
              <Text style={s.supportBtnText}>💬 Suporte</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.manageNote}>
            {isTrial
              ? 'Ao encerrar o trial você volta ao plano grátis imediatamente.'
              : isRecurring
                ? 'Cancelar encerra o acesso imediatamente e para futuras cobranças.'
                : 'Cancelar encerra o acesso imediatamente. O valor pago não é reembolsável.'}
            {'\n'}Para problemas com cobranças, contate suporte.nutriai@outlook.com.
          </Text>
        </View>

      // ── Área não-premium (botão de assinar) ───────────────────────
      ) : (
        <>
          <TouchableOpacity style={[s.ctaBtn, loading && { opacity: 0.7 }]} onPress={handleSubscribe} disabled={loading}>
            {loading ? <ActivityIndicator color={Colors.bg} /> : (
              <View style={{ alignItems: 'center' }}>
                <Text style={s.ctaText}>
                  {billing === 'annual' ? 'Assinar por R$209/ano' : 'Assinar por R$29/mês'}
                </Text>
                <Text style={s.ctaSub}>
                  {billing === 'monthly'
                    ? 'Assinatura recorrente via Mercado Pago · cancele quando quiser'
                    : 'Pagamento único via Mercado Pago · PIX · Cartão · Débito'}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.checkBtn} onPress={() => handleCheckStatus(false)} disabled={loading}>
            <Text style={s.checkBtnText}>Já paguei — verificar status</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Texto legal */}
      <View style={s.legalWrap}>
        <Text style={s.legalText}>
          Ao assinar você concorda com os{' '}
          <Text style={s.legalLink} onPress={() => router.push('/legal/terms' as never)}>Termos de Uso</Text>
          {', '}
          <Text style={s.legalLink} onPress={() => router.push('/legal/privacy' as never)}>Política de Privacidade</Text>
          {' e '}
          <Text style={s.legalLink} onPress={() => router.push('/legal/lgpd' as never)}>Aviso LGPD</Text>
          .
        </Text>
        <Text style={s.legalText}>
          Dúvidas?{' '}
          <Text style={s.legalLink} onPress={() => Linking.openURL('mailto:suporte.nutriai@outlook.com?subject=Dúvida sobre assinatura NutriAI')}>
            suporte.nutriai@outlook.com
          </Text>
        </Text>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:             { flex: 1, backgroundColor: Colors.bg },
  content:          { padding: Spacing[5], paddingBottom: 100 },
  topBar:           { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 16 },
  closeBtn:         { backgroundColor: Colors.bg3, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  closeBtnText:     { fontSize: 13, fontWeight: '600', color: Colors.text2 },
  title:            { fontSize: 24, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  sub:              { fontSize: 14, color: Colors.text2, marginBottom: 16 },

  advantageBanner:  { flexDirection: 'row', gap: 12, backgroundColor: Colors.accent + '12', borderRadius: Radius.lg, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.accent + '30', alignItems: 'flex-start' },
  advIcon:          { fontSize: 24 },
  advTitle:         { fontSize: 13, fontWeight: '700', color: Colors.accent, marginBottom: 2 },
  advSub:           { fontSize: 12, color: Colors.text2, lineHeight: 17 },

  toggleWrap:       { flexDirection: 'row', backgroundColor: Colors.bg3, borderRadius: 12, padding: 3, marginBottom: 16 },
  toggleOpt:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10 },
  toggleOptOn:      { backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2 },
  toggleText:       { fontSize: 13, fontWeight: '500', color: Colors.text2 },
  toggleTextOn:     { color: Colors.text },
  savePill:         { backgroundColor: Colors.teal, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 },
  saveText:         { fontSize: 10, fontWeight: '800', color: Colors.bg },
  recurringPill:    { backgroundColor: Colors.accent + '25', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 },
  recurringText:    { fontSize: 10, fontWeight: '800', color: Colors.accent },

  plansRow:         { flexDirection: 'row', gap: 10, marginBottom: 16 },
  planCard:         { flex: 1, backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border },
  planCardFeatured: { borderColor: Colors.accent + '60', backgroundColor: '#0d1400' },
  popularBadge:     { backgroundColor: Colors.accent + '18', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 8 },
  popularText:      { fontSize: 10, fontWeight: '700', color: Colors.accent },
  planName:         { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  planPrice:        { fontSize: 28, fontWeight: '800', color: Colors.text },
  planPer:          { fontSize: 11, color: Colors.text2, marginBottom: 12 },
  divider:          { height: 1, backgroundColor: Colors.border, marginBottom: 10 },
  featureRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 7 },
  featureCheck:     { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.accent + '18', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  featureCheckNo:   { backgroundColor: Colors.bg3 },
  featureText:      { fontSize: 12, color: Colors.text, flex: 1, lineHeight: 16 },
  featureDisabled:  { opacity: 0.4, textDecorationLine: 'line-through' },

  manageCard:          { backgroundColor: Colors.bg2, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.accent + '40', marginBottom: 12, overflow: 'hidden' },
  activeBanner:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.accent + '12', padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.accent + '20' },
  trialBanner:         { backgroundColor: Colors.teal + '18', borderBottomColor: Colors.teal + '30' },
  trialTitle:          { color: Colors.teal },
  upgradeTrialBanner:  { backgroundColor: Colors.teal + '15', borderBottomWidth: 1, borderBottomColor: Colors.teal + '20', paddingHorizontal: 14, paddingVertical: 10 },
  upgradeTrialText:    { fontSize: 12, color: Colors.teal, fontWeight: '600', textAlign: 'center' },
  activeEmoji:         { fontSize: 24 },
  activeTitle:         { fontSize: 14, fontWeight: '800', color: Colors.accent },
  activeSub:           { fontSize: 12, color: Colors.text2, marginTop: 2 },
  expiryRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10 },
  expiryLabel:      { fontSize: 12, color: Colors.text3 },
  expiryDate:       { fontSize: 13, fontWeight: '700', color: Colors.text },
  manageActions:    { flexDirection: 'row', gap: 8, padding: 12 },
  cancelBtn:        { flex: 1, borderWidth: 1.5, borderColor: '#ff4444', borderRadius: Radius.md, padding: 12, alignItems: 'center' },
  cancelBtnText:    { fontSize: 13, fontWeight: '700', color: '#ff4444' },
  supportBtn:       { borderWidth: 1, borderColor: Colors.border2, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center' },
  supportBtnText:   { fontSize: 13, fontWeight: '600', color: Colors.text2 },
  manageNote:       { fontSize: 11, color: Colors.text3, textAlign: 'center', paddingHorizontal: 14, paddingBottom: 12, lineHeight: 16 },

  ctaBtn:           { backgroundColor: Colors.accent, borderRadius: Radius.md, padding: 16, alignItems: 'center', marginBottom: 10 },
  ctaText:          { fontSize: 16, fontWeight: '800', color: Colors.bg },
  ctaSub:           { fontSize: 11, color: Colors.bg, opacity: 0.7, marginTop: 3 },
  checkBtn:         { borderWidth: 1, borderColor: Colors.border2, borderRadius: Radius.md, padding: 13, alignItems: 'center', marginBottom: 16 },
  checkBtnText:     { fontSize: 13, fontWeight: '600', color: Colors.text2 },

  legalWrap:        { gap: 6, marginBottom: 8 },
  legalText:        { fontSize: 11, color: Colors.text3, textAlign: 'center', lineHeight: 17 },
  legalLink:        { color: Colors.accent, textDecorationLine: 'underline' },
})
