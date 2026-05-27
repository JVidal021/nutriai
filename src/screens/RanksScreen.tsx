import React, { useRef, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Animated } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius, RANKS, PROFILES, XP_VALUES } from '@constants/index'
import { RANK_GRADIENTS, RANK_TEXT_COLOR, SHADOWS } from '@constants/theme'
import { useProgressStore, useUserStore } from '@store/index'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function RanksScreen() {
  const insets = useSafeAreaInsets()
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

  const handleShare = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    await Share.share({
      message:
        `Estou no rank ${rank.emoji} ${rank.label} no NutriAI!\n\n` +
        `🔥 ${progress.streak ?? 0} dias de sequência\n` +
        `⚡ ${(progress.totalXp ?? 0).toLocaleString('pt-BR')} XP\n` +
        `💪 ${progress.workoutsCompleted ?? 0} treinos\n\n` +
        `🌿 NutriAI — Nutrição e treino com IA`,
    })
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>

      <Text style={s.title}>🏆 Ranks & XP</Text>

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
              {(progress.totalXp ?? 0).toLocaleString('pt-BR')} XP
              {next ? ` / ${next.minXp.toLocaleString('pt-BR')}` : ' · Rank máximo'}
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
              Faltam {(next.minXp - (progress.totalXp ?? 0)).toLocaleString('pt-BR')} XP para {next.emoji} {next.label}
            </Text>
          </>
        )}

        <View style={s.statsRow}>
          {[
            { l: 'dias ativos',  v: String(progress.activeDays ?? 0) },
            { l: 'aderência',    v: `${progress.adherencePercent ?? 0}%` },
            { l: 'treinos',      v: String(progress.workoutsCompleted ?? 0) },
          ].map(st => (
            <View key={st.l} style={[s.statBox, { backgroundColor: 'rgba(0,0,0,0.25)' }]}>
              <Text style={[s.statVal, { color: textColor }]}>{st.v}</Text>
              <Text style={[s.statLbl, { color: textColor, opacity: 0.7 }]}>{st.l}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[s.shareBtn, { backgroundColor: 'rgba(0,0,0,0.25)' }]}
          onPress={handleShare}
        >
          <Text style={[s.shareBtnText, { color: textColor }]}>📤 Compartilhar evolução</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Como ganhar XP */}
      <View style={[s.card, SHADOWS.sm]}>
        <Text style={s.cardTitle}>Como ganhar XP</Text>
        {[
          { emoji:'📸', label:'Registrar refeição', sub:'até 3× por dia',      xp: XP_VALUES.MEAL_LOGGED   },
          { emoji:'💪', label:'Completar treino',   sub:'todos os exercícios', xp: XP_VALUES.WORKOUT_DONE  },
          { emoji:'🔥', label:'Streak de 7 dias',   sub:'bônus semanal',       xp: XP_VALUES.STREAK_7_DAYS },
          { emoji:'📋', label:'Check-in diário',    sub:'humor + adaptação',   xp: XP_VALUES.CHECKIN_DONE  },
        ].map(item => (
          <View key={item.label} style={s.xpRow}>
            <Text style={s.xpEmoji}>{item.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.xpLabel}>{item.label}</Text>
              <Text style={s.xpSub}>{item.sub}</Text>
            </View>
            <LinearGradient colors={['#1A1200','#111']} style={s.xpBadge}>
              <Text style={s.xpBadgeText}>+{item.xp} XP</Text>
            </LinearGradient>
          </View>
        ))}
      </View>

      {/* Perfil */}
      <View style={[s.card, SHADOWS.sm]}>
        <Text style={s.cardTitle}>Perfil de treino</Text>
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
                <Text style={s.profileTitle}>{p.title}</Text>
                <Text style={s.profileDesc}>{p.description}</Text>
                <Text style={s.profileBonus}>{p.bonus}</Text>
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

      {/* Tabela de ranks com gradientes */}
      <View style={[s.card, SHADOWS.sm]}>
        <Text style={s.cardTitle}>Tabela de ranks</Text>
        {[
          { tier:'bronze',    emoji:'🥉', label:'Bronze I–III',   range:'0–999 XP'       },
          { tier:'silver',    emoji:'🥈', label:'Prata I–III',    range:'1.000–3.000 XP' },
          { tier:'gold',      emoji:'🥇', label:'Ouro I–III',     range:'3.001–7.000 XP' },
          { tier:'diamond',   emoji:'💎', label:'Diamante I–III', range:'7.001–15.000 XP'},
          { tier:'legendary', emoji:'👑', label:'Lendário',       range:'15.001+ XP'     },
        ].map(row => {
          const isCurrent = row.tier === rank.tier
          if (isCurrent) {
            return (
              <LinearGradient key={row.tier} colors={RANK_GRADIENTS[row.tier]} style={s.rankRowHighlight} start={{x:0,y:0}} end={{x:1,y:0}}>
                <Text style={s.rankRowEmoji}>{row.emoji}</Text>
                <Text style={[s.rankRowLabel, { color: RANK_TEXT_COLOR[row.tier], fontWeight:'700' }]}>
                  {row.label} ← você
                </Text>
                <Text style={[s.rankRowRange, { color: RANK_TEXT_COLOR[row.tier], opacity: 0.8 }]}>{row.range}</Text>
              </LinearGradient>
            )
          }
          return (
            <View key={row.tier} style={s.rankRowNormal}>
              <Text style={[s.rankRowEmoji, { opacity: 0.5 }]}>{row.emoji}</Text>
              <Text style={[s.rankRowLabel, { color: Colors.text2 }]}>{row.label}</Text>
              <Text style={s.rankRowRange}>{row.range}</Text>
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
