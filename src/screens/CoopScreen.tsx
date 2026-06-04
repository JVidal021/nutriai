import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Alert, Share,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius } from '@constants/index'
import { useCoopStore, useProgressStore, useUserStore } from '@store/index'
import { generateCoopCode, isValidCoopCode, normalizeCoopCode } from '@utils/coopCode'
import { db } from '@services/supabase'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useT } from '@/i18n/useT'

export default function CoopScreen() {
  const insets = useSafeAreaInsets()
  const { t } = useT()
  const [codeInput, setCodeInput] = useState('')
  const [joining, setJoining]     = useState(false)
  const [myCode, setMyCode]       = useState<string | null>(null)
  const { session, setSession }   = useCoopStore()
  const { user, isLoading }       = useUserStore()
  const { progress }              = useProgressStore()

  useEffect(() => {
    if (!user?.id) return

    const init = async () => {
      try {
        const { data } = await db.getMyCoopCode(user.id)
        if (data?.code) {
          setMyCode(data.code)
        } else {
          const code = generateCoopCode()
          setMyCode(code)
          try {
            await db.createCoopLink(user.id, code)
          } catch (err) {
            console.warn('[NutriAI] Falha ao salvar código Co-op:', err)
          }
        }
      } catch (err) {
        const code = generateCoopCode()
        setMyCode(code)
        console.warn('[NutriAI] Erro ao carregar código Co-op (tabela ausente?):', err)
      }
    }

    init()
  }, [user?.id])

  if (isLoading || !user) return null

  const handleShareCode = async () => {
    if (!myCode) return
    await Share.share({
      message: t('coop.share_msg' as any, { code: myCode }),
    })
  }

  const handleJoin = async () => {
    const code = normalizeCoopCode(codeInput)
    if (!isValidCoopCode(code)) {
      Alert.alert(t('coop.invalid_code_title' as any), t('coop.invalid_code_msg' as any))
      return
    }
    setJoining(true)
    try {
      const { data, error } = await db.findCoopByCode(code)
      if (error || !data) {
        Alert.alert(t('coop.not_found_title' as any), t('coop.not_found_msg' as any))
        return
      }
      setSession({
        partnerId:          data.user_id,
        partner:            {
          id: data.user_id,
          name: data.users?.name ?? t('coop.stat_days' as any),
          avatarInitial: (data.users?.name ?? 'P').charAt(0),
          isOnline: false,
          todayCaloriesPercent: 0,
          todayWorkoutDone: false,
          rank: { tier: 'bronze', level: 1, emoji: '🥉', label: 'Bronze I', minXp: 0, maxXp: 333 },
        },
        coopCode:           myCode ?? code,
        daysTogetherCount:  0,
        challengesCompleted:0,
        coopStreak:         0,
        syncedMenu:         { dinner: { user: '—', partner: '—' } },
      })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert(
        t('coop.joined_title' as any),
        t('coop.joined_msg' as any, { name: data.users?.name ?? '—' })
      )
    } catch {
      Alert.alert(t('common.error' as any), t('coop.error_join' as any))
    } finally {
      setJoining(false)
    }
  }

  const BENEFITS = [
    { emoji: '📊', textKey: 'coop.benefit_1' },
    { emoji: '🍽️', textKey: 'coop.benefit_2' },
    { emoji: '🏆', textKey: 'coop.benefit_3' },
    { emoji: '💬', textKey: 'coop.benefit_4' },
  ]

  // No active session — show invite screen
  if (!session) return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>{t('coop.title' as any)}</Text>
      <Text style={s.sub}>{t('coop.sub' as any)}</Text>

      <View style={s.card}>
        <Text style={s.cardTitle}>{t('coop.my_code' as any)}</Text>
        <View style={s.codeBox}>
          <Text style={s.codeText}>{myCode ?? '...'}</Text>
        </View>
        <TouchableOpacity style={[s.shareBtn, !myCode && { opacity: 0.4 }]} onPress={handleShareCode} disabled={!myCode}>
          <Text style={s.shareBtnText}>{t('coop.share_code_btn' as any)}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>{t('coop.join_title' as any)}</Text>
        <TextInput
          style={s.codeInput}
          value={codeInput}
          onChangeText={v => setCodeInput(v.toUpperCase())}
          placeholder="NUT-XXXX-XXXX"
          placeholderTextColor={Colors.text3}
          autoCapitalize="characters"
          maxLength={13}
        />
        <TouchableOpacity
          style={[s.joinBtn, joining && { opacity: 0.6 }]}
          onPress={handleJoin}
          disabled={joining}
        >
          <Text style={s.joinBtnText}>
            {joining ? t('coop.connecting' as any) : t('coop.join_btn' as any)}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={s.benefitsCard}>
        <Text style={s.cardTitle}>{t('coop.benefits_title' as any)}</Text>
        {BENEFITS.map(b => (
          <View key={b.textKey} style={s.benefitRow}>
            <Text style={s.benefitEmoji}>{b.emoji}</Text>
            <Text style={s.benefitText}>{t(b.textKey as any)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  )

  // Active session
  const p = session.partner
  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>{t('coop.active_title' as any)}</Text>
      <Text style={s.sub}>{t('coop.days_together' as any, { count: session.daysTogetherCount })}</Text>

      {/* Partner card */}
      <View style={s.partnerCard}>
        <View style={s.partnerAvatars}>
          <View style={[s.avatar, { backgroundColor: Colors.accent }]}>
            <Text style={s.avatarText}>{(user?.name ?? 'V').charAt(0)}</Text>
          </View>
          <Text style={{ fontSize: 24 }}>💪</Text>
          <View style={[s.avatar, { backgroundColor: Colors.teal }]}>
            <Text style={s.avatarText}>{p.avatarInitial}</Text>
          </View>
        </View>
        <View style={s.partnerStats}>
          {[
            { labelKey: 'coop.stat_days',       val: session.daysTogetherCount },
            { labelKey: 'coop.stat_challenges',  val: `${session.challengesCompleted}/10` },
            { labelKey: 'coop.stat_streak',      val: `🔥 ${session.coopStreak}` },
          ].map(stat => (
            <View key={stat.labelKey} style={s.pStat}>
              <Text style={s.pStatVal}>{stat.val}</Text>
              <Text style={s.pStatLbl}>{t(stat.labelKey as any)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Progress comparison */}
      <View style={s.card}>
        <Text style={s.cardTitle}>{t('coop.today_progress' as any)}</Text>
        {[
          { labelKey: 'coop.calories_label', myVal: 75, partnerVal: p.todayCaloriesPercent || 88 },
          { labelKey: 'coop.workout_label',  myVal: 100, partnerVal: p.todayWorkoutDone ? 100 : 30 },
        ].map(row => (
          <View key={row.labelKey} style={s.compRow}>
            <Text style={s.compLabel}>{t(row.labelKey as any)}</Text>
            <View style={s.compBars}>
              <View style={s.compBarWrap}>
                <Text style={s.compName}>{t('coop.you_label' as any)}</Text>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${row.myVal}%`, backgroundColor: Colors.accent }]} />
                </View>
                <Text style={s.compPct}>{row.myVal}%</Text>
              </View>
              <View style={s.compBarWrap}>
                <Text style={s.compName}>{p.name}</Text>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${row.partnerVal}%`, backgroundColor: Colors.teal }]} />
                </View>
                <Text style={s.compPct}>{row.partnerVal}%</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Challenge */}
      <View style={s.challengeCard}>
        <View style={s.cardRow}>
          <Text style={s.cardTitle}>{t('coop.challenge_title' as any)}</Text>
          <View style={s.challengeBadge}><Text style={s.challengeBadgeText}>{t('coop.challenge_badge' as any)}</Text></View>
        </View>
        <Text style={s.challengeDesc}>{t('coop.challenge_desc' as any)}</Text>
        <View style={s.challengeSegs}>
          {Array.from({ length: 7 }, (_, i) => (
            <View key={i} style={[s.seg, i < 5 && s.segDone]} />
          ))}
        </View>
        <Text style={s.challengeReward}>{t('coop.challenge_reward' as any)}</Text>
      </View>

      <TouchableOpacity style={s.leaveBtn} onPress={() => { setSession(null); setCodeInput('') }}>
        <Text style={s.leaveBtnText}>{t('coop.leave_btn' as any)}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:             { flex: 1, backgroundColor: Colors.bg },
  content:          { padding: Spacing[5], paddingBottom: 100 },
  title:            { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  sub:              { fontSize: 13, color: Colors.text2, marginBottom: 16 },
  card:             { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  cardTitle:        { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 10 },
  cardRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  codeBox:          { backgroundColor: Colors.bg3, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
  codeText:         { fontSize: 24, fontWeight: '800', color: Colors.accent, letterSpacing: 4 },
  shareBtn:         { backgroundColor: Colors.bg3, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border2 },
  shareBtnText:     { fontSize: 14, fontWeight: '600', color: Colors.text },
  codeInput:        { backgroundColor: Colors.bg3, borderRadius: 10, padding: 13, fontSize: 16, color: Colors.text, borderWidth: 1, borderColor: Colors.border2, marginBottom: 10, textAlign: 'center', letterSpacing: 3, fontWeight: '700' },
  joinBtn:          { backgroundColor: Colors.accent, borderRadius: 10, padding: 13, alignItems: 'center' },
  joinBtnText:      { fontSize: 14, fontWeight: '700', color: Colors.bg },
  benefitsCard:     { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border },
  benefitRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  benefitEmoji:     { fontSize: 18, width: 24, textAlign: 'center' },
  benefitText:      { flex: 1, fontSize: 13, color: Colors.text2, lineHeight: 18 },
  partnerCard:      { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  partnerAvatars:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 14 },
  avatar:           { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  avatarText:       { fontSize: 18, fontWeight: '800', color: Colors.bg },
  partnerStats:     { flexDirection: 'row', gap: 8 },
  pStat:            { flex: 1, backgroundColor: Colors.bg3, borderRadius: 10, padding: 10, alignItems: 'center' },
  pStatVal:         { fontSize: 16, fontWeight: '700', color: Colors.accent },
  pStatLbl:         { fontSize: 10, color: Colors.text2, marginTop: 2 },
  compRow:          { marginBottom: 12 },
  compLabel:        { fontSize: 12, color: Colors.text2, marginBottom: 6 },
  compBars:         { gap: 5 },
  compBarWrap:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compName:         { fontSize: 11, color: Colors.text2, width: 40 },
  barTrack:         { flex: 1, height: 5, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  barFill:          { height: '100%', borderRadius: 3 },
  compPct:          { fontSize: 11, color: Colors.text2, width: 30, textAlign: 'right' },
  challengeCard:    { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  challengeBadge:   { backgroundColor: Colors.accent + '18', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  challengeBadgeText:{ fontSize: 11, fontWeight: '600', color: Colors.accent },
  challengeDesc:    { fontSize: 13, color: Colors.text2, marginBottom: 10 },
  challengeSegs:    { flexDirection: 'row', gap: 5, marginBottom: 8 },
  seg:              { flex: 1, height: 5, borderRadius: 3, backgroundColor: Colors.border },
  segDone:          { backgroundColor: Colors.accent },
  challengeReward:  { fontSize: 11, color: Colors.text2 },
  leaveBtn:         { borderWidth: 1, borderColor: Colors.border2, borderRadius: Radius.md, padding: 13, alignItems: 'center' },
  leaveBtnText:     { fontSize: 14, fontWeight: '600', color: Colors.text2 },
})
