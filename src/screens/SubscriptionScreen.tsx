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
import { useT } from '@/i18n/useT'

const FEATURES_FREE: Array<{ labelKey: string; ok: boolean }> = [
  { labelKey: 'subscription.feat_f1',  ok: true  },
  { labelKey: 'subscription.feat_f2',  ok: true  },
  { labelKey: 'subscription.feat_f3',  ok: true  },
  { labelKey: 'subscription.feat_f4',  ok: true  },
  { labelKey: 'subscription.feat_f5',  ok: true  },
  { labelKey: 'subscription.feat_f6',  ok: false },
  { labelKey: 'subscription.feat_f7',  ok: false },
  { labelKey: 'subscription.feat_f8',  ok: false },
  { labelKey: 'subscription.feat_f9',  ok: false },
  { labelKey: 'subscription.feat_f10', ok: false },
]

const FEATURES_PREMIUM: Array<{ labelKey: string; ok: boolean }> = [
  { labelKey: 'subscription.feat_p1', ok: true },
  { labelKey: 'subscription.feat_p2', ok: true },
  { labelKey: 'subscription.feat_p3', ok: true },
  { labelKey: 'subscription.feat_p4', ok: true },
  { labelKey: 'subscription.feat_p5', ok: true },
  { labelKey: 'subscription.feat_p6', ok: true },
  { labelKey: 'subscription.feat_p7', ok: true },
  { labelKey: 'subscription.feat_p8', ok: true },
  { labelKey: 'subscription.feat_p9', ok: true },
]

function formatDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets()
  const { t } = useT()
  const [billing,    setBilling]    = useState<'monthly' | 'annual'>('monthly')
  const [loading,    setLoading]    = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const { user, updateUser, isLoading } = useUserStore()

  if (isLoading || !user) return null

  const isTrial      = user.premiumPlan === 'trial'
  const isRecurring  = user.subscriptionType === 'recurring'
  const planLabel    = isTrial
    ? 'Trial'
    : user.premiumPlan === 'annual'
      ? t('subscription.annual' as any)
      : user.premiumPlan === 'monthly'
        ? t('subscription.monthly' as any)
        : '—'
  const billingLabel = isTrial
    ? t('subscription.billing_trial' as any)
    : isRecurring
      ? t('subscription.billing_recurring' as any)
      : t('subscription.billing_annual' as any)
  const expiryLabel  = isTrial
    ? t('subscription.expiry_trial' as any)
    : isRecurring
      ? t('subscription.expiry_recurring' as any)
      : t('subscription.expiry_annual' as any)

  const trialDaysLeft = isTrial && user.premiumExpiresAt
    ? Math.max(0, Math.ceil((new Date(user.premiumExpiresAt).getTime() - Date.now()) / 86_400_000))
    : 0

  const handleSubscribe = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        Alert.alert(t('common.error' as any), t('subscription.login_first' as any))
        return
      }

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-payment`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body:    JSON.stringify({ plan: billing }),
        }
      )
      const data = await res.json()
      if (!data.success || !data.init_point) throw new Error(data.error ?? t('common.error' as any))

      const result = await WebBrowser.openAuthSessionAsync(
        data.init_point,
        'nutriai://'
      )

      if (result.type === 'success') {
        await handleCheckStatus(true)
      } else {
        Alert.alert(
          t('subscription.check_title' as any),
          t('subscription.check_msg' as any),
          [
            { text: t('subscription.check_later' as any), style: 'cancel' },
            { text: t('subscription.check_verify' as any), onPress: () => handleCheckStatus(false) },
          ]
        )
      }
    } catch (err) {
      Alert.alert(t('common.error' as any), err instanceof Error ? err.message : t('common.retry' as any))
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    const msg = isRecurring
      ? t('subscription.cancel_recurring_msg' as any)
      : t('subscription.cancel_annual_msg' as any)

    Alert.alert(
      t('subscription.cancel_title' as any),
      `${msg}${t('subscription.cancel_irreversible' as any)}`,
      [
        { text: t('subscription.cancel_go_back' as any), style: 'cancel' },
        { text: t('subscription.cancel_confirm' as any), style: 'destructive', onPress: confirmCancel },
      ]
    )
  }

  const confirmCancel = async () => {
    setCancelling(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        Alert.alert(t('common.error' as any), t('subscription.session_expired' as any))
        return
      }

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/cancel-subscription`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        }
      )
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? t('common.retry' as any))

      updateUser({
        isPremium:        false,
        premiumPlan:      undefined,
        subscriptionType: undefined,
        mpSubscriptionId: undefined,
        premiumExpiresAt: undefined,
      })

      Alert.alert(
        t('subscription.cancel_success_title' as any),
        t('subscription.cancel_success_msg' as any),
        [{ text: 'Ok' }]
      )
    } catch (err) {
      Alert.alert(
        t('common.error' as any),
        err instanceof Error ? err.message : t('common.retry' as any)
      )
    } finally {
      setCancelling(false)
    }
  }

  const handleCheckStatus = async (silent = false) => {
    setLoading(true)
    try {
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
        Alert.alert(t('subscription.premium_active_title' as any), t('subscription.premium_active_msg' as any))
      } else if (!silent) {
        Alert.alert(
          t('subscription.payment_pending_title' as any),
          t('subscription.payment_pending_msg' as any)
        )
      } else {
        Alert.alert(
          t('subscription.payment_processing_title' as any),
          t('subscription.payment_processing_msg' as any),
          [{ text: 'Ok' }]
        )
      }
    } catch {
      Alert.alert(t('common.error' as any), t('common.retry' as any))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>

      {/* Botão de Fechar */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
          <Text style={s.closeBtnText}>{t('subscription.close_btn' as any)}</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.title}>{t('subscription.page_title' as any)}</Text>
      <Text style={s.sub}>{t('subscription.page_sub' as any)}</Text>

      {/* Banner de vantagem */}
      <View style={s.advantageBanner}>
        <Text style={s.advIcon}>{billing === 'monthly' ? '🔄' : '🎯'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.advTitle}>
            {billing === 'monthly'
              ? t('subscription.adv_monthly_title' as any)
              : t('subscription.adv_annual_title' as any)}
          </Text>
          <Text style={s.advSub}>
            {billing === 'monthly'
              ? t('subscription.adv_monthly_sub' as any)
              : t('subscription.adv_annual_sub' as any)}
          </Text>
        </View>
      </View>

      {/* Toggle mensal / anual */}
      <View style={s.toggleWrap}>
        <TouchableOpacity style={[s.toggleOpt, billing === 'monthly' && s.toggleOptOn]} onPress={() => setBilling('monthly')}>
          <Text style={[s.toggleText, billing === 'monthly' && s.toggleTextOn]}>{t('subscription.monthly' as any)}</Text>
          <View style={s.recurringPill}><Text style={s.recurringText}>{t('subscription.auto' as any)}</Text></View>
        </TouchableOpacity>
        <TouchableOpacity style={[s.toggleOpt, billing === 'annual' && s.toggleOptOn]} onPress={() => setBilling('annual')}>
          <Text style={[s.toggleText, billing === 'annual' && s.toggleTextOn]}>{t('subscription.annual' as any)}</Text>
          <View style={s.savePill}><Text style={s.saveText}>−40%</Text></View>
        </TouchableOpacity>
      </View>

      {/* Cards de planos */}
      <View style={s.plansRow}>
        <View style={s.planCard}>
          <Text style={s.planName}>{t('subscription.free_plan' as any)}</Text>
          <Text style={s.planPrice}>R$0</Text>
          <Text style={s.planPer}>{t('subscription.free_forever' as any)}</Text>
          <View style={s.divider} />
          {FEATURES_FREE.map(f => (
            <View key={f.labelKey} style={s.featureRow}>
              <View style={[s.featureCheck, !f.ok && s.featureCheckNo]}>
                <Text style={{ fontSize: 10, color: f.ok ? Colors.accent : Colors.text3 }}>{f.ok ? '✓' : '✕'}</Text>
              </View>
              <Text style={[s.featureText, !f.ok && s.featureDisabled]}>{t(f.labelKey as any)}</Text>
            </View>
          ))}
        </View>

        <View style={[s.planCard, s.planCardFeatured]}>
          <View style={s.popularBadge}><Text style={s.popularText}>{t('subscription.recommended' as any)}</Text></View>
          <Text style={s.planName}>Premium</Text>
          <Text style={[s.planPrice, { color: Colors.accent }]}>{billing === 'annual' ? 'R$17' : 'R$29'}</Text>
          <Text style={s.planPer}>{billing === 'annual' ? t('subscription.plan_annual_per' as any) : t('subscription.plan_monthly_per' as any)}</Text>
          <View style={s.divider} />
          {FEATURES_PREMIUM.map(f => (
            <View key={f.labelKey} style={s.featureRow}>
              <View style={s.featureCheck}><Text style={{ fontSize: 10, color: Colors.accent }}>✓</Text></View>
              <Text style={s.featureText}>{t(f.labelKey as any)}</Text>
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
                {isTrial
                  ? t('subscription.trial_active' as any, { days: trialDaysLeft, plural: trialDaysLeft !== 1 ? 's' : '' })
                  : t('subscription.premium_active' as any, { plan: planLabel })}
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
                {t('subscription.upgrade_trial_banner' as any)}
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
                <Text style={[s.cancelBtnText, { color: Colors.text3 }]}>{t('subscription.end_trial' as any)}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.cancelBtn, cancelling && { opacity: 0.6 }]}
                onPress={handleCancel}
                disabled={cancelling}
              >
                {cancelling
                  ? <ActivityIndicator size="small" color="#ff4444" />
                  : <Text style={s.cancelBtnText}>{t('subscription.cancel_sub' as any)}</Text>
                }
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={s.supportBtn}
              onPress={() => Linking.openURL('mailto:suporte.nutriai@outlook.com?subject=Problema com assinatura NutriAI')}
            >
              <Text style={s.supportBtnText}>{t('subscription.support_btn' as any)}</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.manageNote}>
            {isTrial
              ? t('subscription.note_trial_end' as any)
              : isRecurring
                ? t('subscription.note_cancel_recurring' as any)
                : t('subscription.note_cancel_annual' as any)}
            {'\n'}{t('subscription.support_note' as any)}
          </Text>
        </View>

      // ── Área não-premium (botão de assinar) ───────────────────────
      ) : (
        <>
          <TouchableOpacity style={[s.ctaBtn, loading && { opacity: 0.7 }]} onPress={handleSubscribe} disabled={loading}>
            {loading ? <ActivityIndicator color={Colors.bg} /> : (
              <View style={{ alignItems: 'center' }}>
                <Text style={s.ctaText}>
                  {billing === 'annual' ? t('subscription.cta_annual' as any) : t('subscription.cta_monthly' as any)}
                </Text>
                <Text style={s.ctaSub}>
                  {billing === 'monthly'
                    ? t('subscription.cta_monthly_sub' as any)
                    : t('subscription.cta_annual_sub' as any)}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.checkBtn} onPress={() => handleCheckStatus(false)} disabled={loading}>
            <Text style={s.checkBtnText}>{t('subscription.already_paid' as any)}</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Texto legal */}
      <View style={s.legalWrap}>
        <Text style={s.legalText}>
          {t('subscription.legal_agree' as any)}{' '}
          <Text style={s.legalLink} onPress={() => router.push('/legal/terms' as never)}>{t('onboarding.terms_link' as any)}</Text>
          {', '}
          <Text style={s.legalLink} onPress={() => router.push('/legal/privacy' as never)}>{t('onboarding.privacy_link' as any)}</Text>
          {' '}{t('onboarding.and' as any)}{' '}
          <Text style={s.legalLink} onPress={() => router.push('/legal/lgpd' as never)}>{t('onboarding.consent_lgpd_link' as any)}</Text>
          .
        </Text>
        <Text style={s.legalText}>
          {t('subscription.legal_questions' as any)}{' '}
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
