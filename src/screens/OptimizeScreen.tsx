import React from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { Colors, Spacing, Radius } from '@constants/index'
import { useProgressStore, useUserStore } from '@store/index'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { calcEfficiencyScore, weeksToGoal } from '@utils/index'
import { useT } from '@/i18n/useT'

export default function OptimizeScreen() {
  const insets = useSafeAreaInsets()
  const { t } = useT()
  const { user, isLoading } = useUserStore()
  const { progress } = useProgressStore()

  if (isLoading || !user) return null

  const efficiency = calcEfficiencyScore({
    adherencePercent:   progress.adherencePercent,
    streak:             progress.streak,
    avgSleepHours:      7.3,
    avgHydrationLiters: 1.8,
  })

  const weeks = user ? weeksToGoal(user.weight, user.targetWeight) : 0

  const scoreLabel = efficiency >= 80
    ? t('optimize.score_efficient' as any)
    : efficiency >= 60
      ? t('optimize.score_progress' as any)
      : t('optimize.score_attention' as any)

  const patterns = [
    { color: Colors.teal,   titleKey: 'optimize.pattern1_title', descKey: 'optimize.pattern1_desc' },
    { color: Colors.orange, titleKey: 'optimize.pattern2_title', descKey: 'optimize.pattern2_desc' },
    { color: Colors.purple, titleKey: 'optimize.pattern3_title', descKey: 'optimize.pattern3_desc' },
    { color: Colors.red,    titleKey: 'optimize.pattern4_title', descKey: 'optimize.pattern4_desc' },
  ]

  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>{t('optimize.title' as any)}</Text>
      <Text style={s.sub}>{t('optimize.sub' as any)}</Text>

      <View style={s.scoreCard}>
        <Text style={s.scoreSub}>{t('optimize.efficiency_label' as any)}</Text>
        <Text style={s.scoreNum}>{efficiency}</Text>
        <Text style={s.scoreLabel}>{scoreLabel}</Text>
        <View style={s.scoreBar}>
          <View style={[s.scoreBarFill, { flex: efficiency / 100 }]} />
        </View>
        <Text style={s.scoreFooter}>
          {t('optimize.goal_weeks' as any, { weeks })}
        </Text>
      </View>

      <View style={s.metricsGrid}>
        {[
          { labelKey: 'optimize.kcal_workout', val: '+340',            color: Colors.purple },
          { labelKey: 'optimize.weekly_pace',  val: '−0,4kg',          color: Colors.teal   },
          { labelKey: 'optimize.adherence',    val: `${progress.adherencePercent}%`, color: Colors.accent },
          { labelKey: 'optimize.days_to_goal', val: String(weeks * 7), color: Colors.orange },
        ].map(m => (
          <View key={m.labelKey} style={s.metricBox}>
            <Text style={[s.metricVal, { color: m.color }]}>{m.val}</Text>
            <Text style={s.metricLbl}>{t(m.labelKey as any)}</Text>
          </View>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>{t('optimize.patterns_title' as any)}</Text>
        {patterns.map(p => (
          <View key={p.titleKey} style={s.patternRow}>
            <View style={[s.patternDot, { backgroundColor: p.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.patternTitle}>{t(p.titleKey as any)}</Text>
              <Text style={s.patternDesc}>{t(p.descKey as any)}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>{t('optimize.sim_title' as any)}</Text>
        <View style={s.scenarioRow}>
          {[
            { val: t('optimize.sim_weeks' as any),   labelKey: 'optimize.sim_weeks_label',   color: Colors.teal   },
            { val: String(Math.min(efficiency + 5, 100)), labelKey: 'optimize.sim_efficiency', color: Colors.accent },
            { val: t('optimize.sim_kcal' as any),    labelKey: 'optimize.sim_kcal_label',    color: Colors.purple },
          ].map(item => (
            <View key={item.labelKey} style={s.scenarioBox}>
              <Text style={[s.scenarioVal, { color: item.color }]}>{item.val}</Text>
              <Text style={s.scenarioLbl}>{t(item.labelKey as any)}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: Colors.bg },
  content:       { padding: Spacing[5], paddingBottom: 100 },
  title:         { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  sub:           { fontSize: 13, color: Colors.text2, marginBottom: 16 },
  scoreCard:     { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 20, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', marginBottom: 12 },
  scoreSub:      { fontSize: 12, color: Colors.text2, marginBottom: 4 },
  scoreNum:      { fontSize: 56, fontWeight: '800', color: Colors.accent, lineHeight: 60 },
  scoreLabel:    { fontSize: 13, color: Colors.teal, marginBottom: 10 },
  scoreBar:      { width: '100%', height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden', marginBottom: 10, flexDirection: 'row' },
  scoreBarFill:  { backgroundColor: Colors.accent },
  scoreFooter:   { fontSize: 13, color: Colors.text2, textAlign: 'center' },
  metricsGrid:   { flexDirection: 'row', gap: 8, marginBottom: 10 },
  metricBox:     { flex: 1, backgroundColor: Colors.bg2, borderRadius: Radius.md, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  metricVal:     { fontSize: 16, fontWeight: '700' },
  metricLbl:     { fontSize: 9, color: Colors.text2, marginTop: 2, textAlign: 'center' },
  card:          { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  cardTitle:     { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 12 },
  patternRow:    { flexDirection: 'row', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  patternDot:    { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  patternTitle:  { fontSize: 13, fontWeight: '500', color: Colors.text },
  patternDesc:   { fontSize: 11, color: Colors.text2, marginTop: 2, lineHeight: 16 },
  scenarioRow:   { flexDirection: 'row', gap: 8 },
  scenarioBox:   { flex: 1, backgroundColor: Colors.bg3, borderRadius: 10, padding: 10, alignItems: 'center' },
  scenarioVal:   { fontSize: 16, fontWeight: '700' },
  scenarioLbl:   { fontSize: 9, color: Colors.text2, marginTop: 2, textAlign: 'center' },
})
