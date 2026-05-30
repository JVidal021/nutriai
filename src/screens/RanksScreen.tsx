import React, { useRef, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Animated } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius, RANKS, PROFILES, XP_VALUES } from '@constants/index'
import { RANK_GRADIENTS, RANK_TEXT_COLOR, SHADOWS } from '@constants/theme'
import { useProgressStore, useUserStore } from '@store/index'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useT } from '@/i18n/useT'

export default function RanksScreen() {
  const insets = useSafeAreaInsets()
  const { t } = useT()
  const { progress, getRankProgress } = useProgressStore()
  const { user, updateUser, isLoading } = useUserStore()
  const { current: rank, next, percent } = getRankProgress()

  const barAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.spring(barAnim, {
      toValue: percent / 100,
      tension: 40, friction: 7, useNativeDriver: false,
    }).start()
  }, [percent])
  const barWidth = barAnim.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] })

  if (isLoading || !user) return null

  const gradColors = RANK_GRADIENTS[rank.tier] ?? ['#555','#333']
  const textColor  = RANK_TEXT_COLOR[rank.tier] ?? '#FFF'

  // ─── Profile helpers ───────────────────────────────────────────────────────
  const getProfileTitle = (id: string): string => ({
    escultura:  t('onboarding.profile_escultura_title' as any),
    vitalidade: t('onboarding.profile_vitalidade_title' as any),
    harmonia:   t('onboarding.profile_harmonia_title' as any),
  }[id] ?? id)

  const getProfileDesc = (id: string): string => ({
    escultura:  t('onboarding.profile_escultura_desc' as any),
    vitalidade: t('onboarding.profile_vitalidade_desc' as any),
    harmonia:   t('onboarding.profile_harmonia_desc' as any),
  }[id] ?? id)

  const getProfileBonus = (id: string): string => ({
    escultura:  t('onboarding.profile_escultura_bonus' as any),
    vitalidade: t('onboarding.profile_vitalidade_bonus' as any),
    harmonia:   t('onboarding.profile_harmonia_bonus' as any),
  }[id] ?? id)

  const handleShare = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    await Share.share({
      message: t('ranks.share_msg' as any, {
        emoji:    rank.emoji,
        label:    rank.label,
        streak:   progress.streak ?? 0,
        xp:       (progress.totalXp ?? 0).toLocaleString(),
        workouts: progress.workoutsCompleted ?? 0,
      }),
    })
  }

  const EARN_ITEMS = [
    { emoji:'📸', labelKey:'ranks.earn_meal_label',    subKey:'ranks.earn_meal_sub',    xp: XP_VALUES.MEAL_LOGGED   },
    { emoji:'💪', labelKey:'ranks.earn_workout_label', subKey:'ranks.earn_workout_sub', xp: XP_VALUES.WORKOUT_DONE  },
    { emoji:'🔥', labelKey:'ranks.earn_streak_label',  subKey:'ranks.earn_streak_sub',  xp: XP_VALUES.STREAK_7_DAYS },
    { emoji:'📋', labelKey:'ranks.earn_checkin_label', subKey:'ranks.earn_checkin_sub', xp: XP_VALUES.CHECKIN_DONE  },
  ]

  const RANK_ROWS = [
    { tier:'bronze',    emoji:'🥉', labelKey:'ranks.bronze',    rangeKey:'ranks.bronze_range'    },
    { tier:'silver',    emoji:'🥈', labelKey:'ranks.silver',    rangeKey:'ranks.silver_range'    },
    { tier:'gold',      emoji:'🥇', labelKey:'ranks.gold',      rangeKey:'ranks.gold_range'      },
    { tier:'diamond',   emoji:'💎', labelKey:'ranks.diamond',   rangeKey:'ranks.diamond_range'   },
    { tier:'legendary', emoji:'👑', labelKey:'ranks.legendary', rangeKey:'ranks.legendary_range' },
  ]

  const STATS = [
    { labelKey: 'profile.stat_active_days', v: String(progress.activeDays ?? 0)         },
    { labelKey: 'profile.stat_adherence',   v: `${progress.adherencePercent ?? 0}%`      },
    { labelKey: 'profile.stat_workouts',    v: String(progress.workoutsCompleted ?? 0)   },
  ]

  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>

      <Text style={s.title}>{t('ranks.title' as any)}</Text>

      {/* Card de rank com gradiente dinâmico */}
      <LinearGradient
        colors={gradColors}
        style={[s.rankCard, SHADOWS.rank]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <View style={s.rankTop}>
          <Text style={[s.rankEmojiBig, { textShadowColor: textColor, textShadowRadius: 20 }]}>
            {rank.emoji}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.rankLabelBig, { color: textColor }]}>{rank.label}</Text>
            <Text style={[s.rankXpText, { color: textColor, opacity: 0.8 }]}>
              {(progress.totalXp ?? 0).toLocaleString()} XP
              {next
                ? ` / ${next.minXp.toLocaleString()}`
                : ` ${t('ranks.max_rank' as any)}`}
            </Text>
          </View>
          <View style={[s.streakPill, { backgroundColor: 'rgba(0,0,0,0.25)' }]}>
            <Text style={[s.streakText, { color: textColor }]}>🔥 {progress.streak ?? 0}</Text>
          </View>
        </View>

        {next && (
          <>
            <View style={[s.xpBarTrack, { backgroundColor: 'rgba(0,0,0,0.25)' }]}>
              <Animated.View style={[s.xpBarFill, { width: barWidth, backgroundColor: textColor }]} />
            </View>
            <Text style={[s.xpNextText, { color: textColor, opacity: 0.75 }]}>
              {t('ranks.xp_remaining' as any, {
                xp:    (next.minXp - (progress.totalXp ?? 0)).toLocaleString(),
                emoji: next.emoji,
                label: next.label,
              })}
            </Text>
          </>
        )}

        <View style={s.statsRow}>
          {STATS.map(st => (
            <View key={st.labelKey} style={[s.statBox, { backgroundColor: 'rgba(0,0,0,0.25)' }]}>
              <Text style={[s.statVal, { color: textColor }]}>{st.v}</Text>
              <Text style={[s.statLbl, { color: textColor, opacity: 0.7 }]}>{t(st.labelKey as any)}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[s.shareBtn, { backgroundColor: 'rgba(0,0,0,0.25)' }]}
          onPress={handleShare}
        >
          <Text style={[s.shareBtnText, { color: textColor }]}>{t('ranks.share_btn' as any)}</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Como ganhar XP */}
      <View style={[s.card, SHADOWS.sm]}>
        <Text style={s.cardTitle}>{t('ranks.how_to_earn' as any)}</Text>
        {EARN_ITEMS.map(item => (
          <View key={item.labelKey} style={s.xpRow}>
            <Text style={s.xpEmoji}>{item.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.xpLabel}>{t(item.labelKey as any)}</Text>
              <Text style={s.xpSub}>{t(item.subKey as any)}</Text>
            </View>
            <LinearGradient colors={['#1A1200','#111']} style={s.xpBadge}>
              <Text style={s.xpBadgeText}>+{item.xp} XP</Text>
            </LinearGradient>
          </View>
        ))}
      </View>

      {/* Perfil */}
      <View style={[s.card, SHADOWS.sm]}>
        <Text style={s.cardTitle}>{t('ranks.workout_profile' as any)}</Text>
        {PROFILES.map(p => {
          const isSel = user?.profile === p.id
          return (
            <TouchableOpacity
              key={p.id}
              style={[s.profileCard, isSel && s.profileCardSel]}
              onPress={() => updateUser({ profile: p.id as typeof user.profile })}
            >
              <Text style={s.profileEmoji}>{p.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.profileTitle}>{getProfileTitle(p.id)}</Text>
                <Text style={s.profileDesc}>{getProfileDesc(p.id)}</Text>
                <Text style={s.profileBonus}>{getProfileBonus(p.id)}</Text>
              </View>
              {isSel && (
                <LinearGradient colors={['#C8F060','#A8D040']} style={s.checkCircle}>
                  <Text style={{ fontSize: 12, color: Colors.bg, fontWeight: '800' }}>✓</Text>
                </LinearGradient>
              )}
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Tabela de ranks */}
      <View style={[s.card, SHADOWS.sm]}>
        <Text style={s.cardTitle}>{t('ranks.rank_table' as any)}</Text>
        {RANK_ROWS.map(row => {
          const isCurrent = row.tier === rank.tier
          if (isCurrent) {
            return (
              <LinearGradient key={row.tier} colors={RANK_GRADIENTS[row.tier]} style={s.rankRowHighlight} start={{x:0,y:0}} end={{x:1,y:0}}>
                <Text style={s.rankRowEmoji}>{row.emoji}</Text>
                <Text style={[s.rankRowLabel, { color: RANK_TEXT_COLOR[row.tier], fontWeight:'700' }]}>
                  {t(row.labelKey as any)} {t('ranks.current' as any)}
                </Text>
                <Text style={[s.rankRowRange, { color: RANK_TEXT_COLOR[row.tier], opacity: 0.8 }]}>{t(row.rangeKey as any)}</Text>
              </LinearGradient>
            )
          }
          return (
            <View key={row.tier} style={s.rankRowNormal}>
              <Text style={[s.rankRowEmoji, { opacity: 0.5 }]}>{row.emoji}</Text>
              <Text style={[s.rankRowLabel, { color: Colors.text2 }]}>{t(row.labelKey as any)}</Text>
              <Text style={s.rankRowRange}>{t(row.rangeKey as any)}</Text>
            </View>
          )
        })}
      </View>

    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:              { flex: 1, backgroundColor: Colors.bg },
  content:           { padding: Spacing[5], paddingBottom: 100 },
  title:             { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 14 },
  rankCard:          { borderRadius: Radius.lg + 4, padding: 18, marginBottom: 12 },
  rankTop:           { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  rankEmojiBig:      { fontSize: 50 },
  rankLabelBig:      { fontSize: 24, fontWeight: '800' },
  rankXpText:        { fontSize: 12, marginTop: 2 },
  streakPill:        { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  streakText:        { fontSize: 12, fontWeight: '700' },
  xpBarTrack:        { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 6, flexDirection: 'row' },
  xpBarFill:         { height: '100%', borderRadius: 3, opacity: 0.9 },
  xpNextText:        { fontSize: 11, marginBottom: 12 },
  statsRow:          { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statBox:           { flex: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  statVal:           { fontSize: 16, fontWeight: '700' },
  statLbl:           { fontSize: 9, marginTop: 2 },
  shareBtn:          { borderRadius: 10, padding: 11, alignItems: 'center' },
  shareBtnText:      { fontSize: 13, fontWeight: '600' },
  card:              { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  cardTitle:         { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 12 },
  xpRow:             { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  xpEmoji:           { fontSize: 20, width: 28, textAlign: 'center' },
  xpLabel:           { fontSize: 13, fontWeight: '500', color: Colors.text },
  xpSub:             { fontSize: 11, color: Colors.text2, marginTop: 1 },
  xpBadge:           { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.orange + '30' },
  xpBadgeText:       { fontSize: 11, fontWeight: '700', color: Colors.orange },
  profileCard:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  profileCardSel:    { borderColor: Colors.accent + '60', backgroundColor: '#0D1400' },
  profileEmoji:      { fontSize: 26 },
  profileTitle:      { fontSize: 14, fontWeight: '600', color: Colors.text },
  profileDesc:       { fontSize: 12, color: Colors.text2, marginTop: 1 },
  profileBonus:      { fontSize: 11, color: Colors.accent, marginTop: 2 },
  checkCircle:       { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rankRowHighlight:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4 },
  rankRowNormal:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rankRowEmoji:      { fontSize: 18, width: 24, textAlign: 'center' },
  rankRowLabel:      { flex: 1, fontSize: 13 },
  rankRowRange:      { fontSize: 11, color: Colors.text3 },
})
