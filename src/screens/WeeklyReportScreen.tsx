import React, { useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Share,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius } from '@constants/index'
import { useProgressStore, useNutritionStore, useWorkoutStore, useUserStore } from '@store/index'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns'
import { useT } from '@/i18n/useT'

// Day-of-week index (0=Sun … 6=Sat) → days_short key
const DOW_KEYS = [
  'days_short.sun', 'days_short.mon', 'days_short.tue', 'days_short.wed',
  'days_short.thu', 'days_short.fri', 'days_short.sat',
]

export default function WeeklyReportScreen() {
  const insets = useSafeAreaInsets()
  const { t } = useT()
  const { user, isLoading } = useUserStore()
  const { progress, xpHistory, checkins } = useProgressStore()
  const { weekPlan } = useNutritionStore()
  const { weekWorkouts } = useWorkoutStore()

  const today     = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekEnd   = endOfWeek(today, { weekStartsOn: 1 })

  const weekLabel = `${weekStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`

  // ─── Cálculos da semana ────────────────────────────────────────────────
  const stats = useMemo(() => {
    const startStr = format(weekStart, 'yyyy-MM-dd')
    const endStr   = format(weekEnd, 'yyyy-MM-dd')

    // XP da semana
    const weekXp = (xpHistory ?? [])
      .filter(x => x?.date >= startStr + 'T' && x?.date <= endStr + 'T23:59:59')
      .reduce((a, x) => a + (x?.xp ?? 0), 0)

    // Treinos da semana
    const workoutsDone = weekWorkouts.filter(w =>
      w.completed && w.date >= startStr && w.date <= endStr
    ).length

    // Refeições registradas
    const mealsLogged = weekPlan.reduce((acc, day) => {
      if (day.date >= startStr && day.date <= endStr) {
        return acc + day.meals.filter(m => m.completed).length
      }
      return acc
    }, 0)

    // Dias com check-in
    const checkinsThisWeek = (checkins ?? []).filter(c =>
      c.date >= startStr && c.date <= endStr
    ).length

    // Aderência alimentar
    const totalMeals = weekPlan
      .filter(d => d.date >= startStr && d.date <= endStr)
      .reduce((a, d) => a + d.meals.length, 0)
    const adherence = totalMeals > 0
      ? Math.round((mealsLogged / totalMeals) * 100)
      : 0

    // XP por dia — store dayKey for i18n
    const xpByDay = Array.from({ length: 7 }, (_, i) => {
      const d       = subDays(weekEnd, 6 - i)
      const dateStr = format(d, 'yyyy-MM-dd')
      const xp      = (xpHistory ?? [])
        .filter(x => x?.date?.startsWith(dateStr))
        .reduce((a, x) => a + (x?.xp ?? 0), 0)
      const dayKey  = DOW_KEYS[d.getDay()]
      return { dayKey, xp, date: dateStr }
    })
    const bestDay = xpByDay.reduce((a, b) => b.xp > a.xp ? b : a, xpByDay[0])

    return { weekXp, workoutsDone, mealsLogged, checkinsThisWeek, adherence, xpByDay, bestDay }
  }, [xpHistory, weekWorkouts, weekPlan, checkins])

  const maxXp = Math.max(...stats.xpByDay.map(d => d.xp), 1)

  // ─── Compartilhar ─────────────────────────────────────────────────────
  const handleShare = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const medal = stats.adherence >= 80 ? '🏅' : stats.adherence >= 50 ? '📈' : '💪'
    await Share.share({
      message: t('weekly_report.share_msg' as any, {
        medal,
        weekLabel,
        xp:        stats.weekXp,
        workouts:  stats.workoutsDone,
        meals:     stats.mealsLogged,
        adherence: stats.adherence,
      }),
    })
  }

  // ─── Insight automático ────────────────────────────────────────────────
  const insight = useMemo(() => {
    if (stats.workoutsDone === 0 && stats.mealsLogged === 0) {
      return { icon: '💡', textKey: 'weekly_report.insight_empty', params: {}, color: Colors.text2 }
    }
    if (stats.adherence >= 80 && stats.workoutsDone >= 3) {
      return { icon: '🔥', textKey: 'weekly_report.insight_great', params: { adherence: stats.adherence, workouts: stats.workoutsDone }, color: Colors.teal }
    }
    if (stats.workoutsDone >= 3) {
      return { icon: '💪', textKey: 'weekly_report.insight_workouts', params: { workouts: stats.workoutsDone }, color: Colors.accent }
    }
    if (stats.adherence >= 80) {
      return { icon: '🥗', textKey: 'weekly_report.insight_adherence', params: { adherence: stats.adherence }, color: Colors.purple }
    }
    return { icon: '📈', textKey: 'weekly_report.insight_default', params: {}, color: Colors.orange }
  }, [stats])

  // Early return DEPOIS de todos os hooks (Regras dos Hooks)
  if (isLoading || !user) return null

  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>{t('weekly_report.title' as any)}</Text>
          <Text style={s.sub}>{weekLabel}</Text>
        </View>
        <TouchableOpacity style={s.shareBtn} onPress={handleShare}>
          <Text style={s.shareBtnText}>📤</Text>
        </TouchableOpacity>
      </View>

      {/* Insight da IA */}
      <View style={[s.insightCard, { borderColor: insight.color + '40' }]}>
        <Text style={s.insightIcon}>{insight.icon}</Text>
        <Text style={[s.insightText, { color: insight.color }]}>{t(insight.textKey as any, insight.params as any) as string}</Text>
      </View>

      {/* Cards de stats */}
      <View style={s.statsGrid}>
        {[
          { emoji: '⚡', labelKey: 'weekly_report.xp_earned',      val: stats.weekXp.toLocaleString(),      color: Colors.accent  },
          { emoji: '💪', labelKey: 'weekly_report.workouts_done',  val: `${stats.workoutsDone}/5`,           color: Colors.purple  },
          { emoji: '📸', labelKey: 'weekly_report.meals_logged',   val: String(stats.mealsLogged),           color: Colors.teal    },
          { emoji: '✅', labelKey: 'weekly_report.adherence',      val: `${stats.adherence}%`,               color: Colors.orange  },
          { emoji: '🌿', labelKey: 'weekly_report.checkins_done',  val: `${stats.checkinsThisWeek}/7`,       color: Colors.purple  },
          { emoji: '🔥', labelKey: 'weekly_report.best_day',       val: stats.bestDay.xp > 0 ? t(stats.bestDay.dayKey as any) : '—', color: Colors.red },
        ].map(stat => (
          <View key={stat.labelKey} style={s.statCard}>
            <Text style={s.statEmoji}>{stat.emoji}</Text>
            <Text style={[s.statVal, { color: stat.color }]}>{stat.val}</Text>
            <Text style={s.statLabel}>{t(stat.labelKey as any)}</Text>
          </View>
        ))}
      </View>

      {/* Gráfico de XP por dia */}
      <View style={s.card}>
        <Text style={s.cardTitle}>{t('weekly_report.xp_per_day' as any)}</Text>
        <View style={s.chart}>
          {stats.xpByDay.map(d => {
            const h = maxXp > 0 ? (d.xp / maxXp) * 100 : 0
            const isToday = d.date === format(today, 'yyyy-MM-dd')
            return (
              <View key={d.date} style={s.chartBar}>
                <Text style={s.chartXp}>{d.xp > 0 ? d.xp : ''}</Text>
                <View style={s.chartBarOuter}>
                  <View style={[
                    s.chartBarFill,
                    { flexBasis: `${Math.max(h, 4)}%`,
                      backgroundColor: isToday ? Colors.accent : Colors.purple + '80' }
                  ]} />
                </View>
                <Text style={[s.chartLabel, isToday && { color: Colors.accent, fontWeight: '700' }]}>
                  {t(d.dayKey as any)}
                </Text>
              </View>
            )
          })}
        </View>
      </View>

      {/* Evolução */}
      <View style={s.card}>
        <Text style={s.cardTitle}>{t('weekly_report.evolution' as any)}</Text>
        {[
          { labelKey: 'weekly_report.current_streak', val: `${progress.streak ?? 0} ${t('weekly_report.days_unit' as any)}`,          bar: Math.min((progress.streak ?? 0) / 30, 1), color: Colors.orange },
          { labelKey: 'weekly_report.best_streak',    val: `${progress.longestStreak ?? 0} ${t('weekly_report.days_unit' as any)}`,   bar: Math.min((progress.longestStreak ?? 0) / 30, 1), color: Colors.teal },
          { labelKey: 'weekly_report.general_adherence', val: `${progress.adherencePercent ?? 0}%`, bar: (progress.adherencePercent ?? 0) / 100, color: Colors.accent },
        ].map(item => (
          <View key={item.labelKey} style={s.progressRow}>
            <View style={s.progressLabelRow}>
              <Text style={s.progressLabel}>{t(item.labelKey as any)}</Text>
              <Text style={[s.progressVal, { color: item.color }]}>{item.val}</Text>
            </View>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { flex: item.bar, backgroundColor: item.color }]} />
            </View>
          </View>
        ))}
      </View>

      {/* Próxima semana */}
      <View style={s.card}>
        <Text style={s.cardTitle}>{t('weekly_report.next_week_challenge' as any)}</Text>
        <View style={s.challengeRow}>
          <Text style={s.challengeEmoji}>💪</Text>
          <Text style={s.challengeText}>
            {stats.workoutsDone < 3
              ? t('weekly_report.challenge_workout_more' as any, { count: 3 - stats.workoutsDone })
              : t('weekly_report.challenge_workout_keep' as any)}
          </Text>
        </View>
        <View style={s.challengeRow}>
          <Text style={s.challengeEmoji}>📸</Text>
          <Text style={s.challengeText}>
            {stats.adherence < 80
              ? t('weekly_report.challenge_meals_improve' as any)
              : t('weekly_report.challenge_meals_keep' as any)}
          </Text>
        </View>
        <View style={s.challengeRow}>
          <Text style={s.challengeEmoji}>💧</Text>
          <Text style={s.challengeText}>{t('weekly_report.challenge_water' as any)}</Text>
        </View>
      </View>

    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: Colors.bg },
  content:         { padding: Spacing[5], paddingBottom: 100 },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  title:           { fontSize: 22, fontWeight: '800', color: Colors.text },
  sub:             { fontSize: 13, color: Colors.text2, marginTop: 2 },
  shareBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.bg3, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  shareBtnText:    { fontSize: 18 },
  insightCard:     { flexDirection: 'row', gap: 10, backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, marginBottom: 14, alignItems: 'flex-start' },
  insightIcon:     { fontSize: 24 },
  insightText:     { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  statsGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  statCard:        { width: '47%', backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  statEmoji:       { fontSize: 24, marginBottom: 6 },
  statVal:         { fontSize: 22, fontWeight: '800' },
  statLabel:       { fontSize: 11, color: Colors.text2, marginTop: 3, textAlign: 'center' },
  card:            { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  cardTitle:       { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 14 },
  chart:           { flexDirection: 'row', height: 120, alignItems: 'flex-end', gap: 6 },
  chartBar:        { flex: 1, alignItems: 'center', gap: 4 },
  chartXp:         { fontSize: 9, color: Colors.text3, height: 12 },
  chartBarOuter:   { flex: 1, width: '100%', backgroundColor: Colors.bg3, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end', flexDirection: 'column' },
  chartBarFill:    { width: '100%', borderRadius: 4, alignSelf: 'flex-end' },
  chartLabel:      { fontSize: 10, color: Colors.text2 },
  progressRow:     { marginBottom: 12 },
  progressLabelRow:{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  progressLabel:   { fontSize: 13, color: Colors.text2 },
  progressVal:     { fontSize: 13, fontWeight: '700' },
  progressTrack:   { height: 5, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden', flexDirection: 'row' },
  progressFill:    { borderRadius: 3 },
  challengeRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  challengeEmoji:  { fontSize: 18 },
  challengeText:   { flex: 1, fontSize: 13, color: Colors.text, lineHeight: 18 },
})
