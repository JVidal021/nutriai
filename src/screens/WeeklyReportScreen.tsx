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
import { ptBR } from 'date-fns/locale'

export default function WeeklyReportScreen() {
  const insets = useSafeAreaInsets()
  const { user, isLoading } = useUserStore()
  const { progress, xpHistory, checkins } = useProgressStore()
  const { weekPlan } = useNutritionStore()
  const { weekWorkouts } = useWorkoutStore()

  if (isLoading || !user) return null

  const today     = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekEnd   = endOfWeek(today, { weekStartsOn: 1 })

  const weekLabel = `${format(weekStart, 'd MMM', { locale: ptBR })} – ${format(weekEnd, 'd MMM', { locale: ptBR })}`

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

    // Melhor dia da semana (mais XP)
    const xpByDay = Array.from({ length: 7 }, (_, i) => {
      const d = format(subDays(weekEnd, 6 - i), 'yyyy-MM-dd')
      const xp = (xpHistory ?? [])
        .filter(x => x?.date?.startsWith(d))
        .reduce((a, x) => a + (x?.xp ?? 0), 0)
      return { day: format(subDays(weekEnd, 6 - i), 'EEE', { locale: ptBR }), xp, date: d }
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
      message:
        `Meu resumo semanal no NutriAI ${medal}\n\n` +
        `📅 ${weekLabel}\n` +
        `⚡ ${stats.weekXp} XP ganhos\n` +
        `💪 ${stats.workoutsDone} treinos completados\n` +
        `📸 ${stats.mealsLogged} refeições registradas\n` +
        `✅ ${stats.adherence}% de aderência alimentar\n\n` +
        `🌿 NutriAI — Nutrição e treinos com IA`,
    })
  }

  // ─── Insight automático ────────────────────────────────────────────────
  const insight = useMemo(() => {
    if (stats.workoutsDone === 0 && stats.mealsLogged === 0) {
      return { icon: '💡', text: 'Semana desafiadora? Não desanime — amanhã é uma nova oportunidade. Uma refeição registrada já conta!', color: Colors.text2 }
    }
    if (stats.adherence >= 80 && stats.workoutsDone >= 3) {
      return { icon: '🔥', text: `Semana incrível! ${stats.adherence}% de aderência e ${stats.workoutsDone} treinos — você está no caminho certo.`, color: Colors.teal }
    }
    if (stats.workoutsDone >= 3) {
      return { icon: '💪', text: `${stats.workoutsDone} treinos nesta semana! Foque agora em registrar as refeições para a IA otimizar melhor seu plano.`, color: Colors.accent }
    }
    if (stats.adherence >= 80) {
      return { icon: '🥗', text: `${stats.adherence}% de aderência alimentar — ótima consistência! Adicionar mais treinos vai acelerar seus resultados.`, color: Colors.purple }
    }
    return { icon: '📈', text: 'Consistência é o segredo. Pequenas ações diárias criam grandes resultados ao longo do tempo.', color: Colors.orange }
  }, [stats])

  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>📊 Relatório semanal</Text>
          <Text style={s.sub}>{weekLabel}</Text>
        </View>
        <TouchableOpacity style={s.shareBtn} onPress={handleShare}>
          <Text style={s.shareBtnText}>📤</Text>
        </TouchableOpacity>
      </View>

      {/* Insight da IA */}
      <View style={[s.insightCard, { borderColor: insight.color + '40' }]}>
        <Text style={s.insightIcon}>{insight.icon}</Text>
        <Text style={[s.insightText, { color: insight.color }]}>{insight.text}</Text>
      </View>

      {/* Cards de stats */}
      <View style={s.statsGrid}>
        {[
          { emoji: '⚡', label: 'XP ganhos',           val: stats.weekXp.toLocaleString('pt-BR'), color: Colors.accent  },
          { emoji: '💪', label: 'Treinos feitos',       val: `${stats.workoutsDone}/5`,            color: Colors.purple  },
          { emoji: '📸', label: 'Refeições registradas',val: String(stats.mealsLogged),             color: Colors.teal   },
          { emoji: '✅', label: 'Aderência alimentar',   val: `${stats.adherence}%`,                color: Colors.orange  },
          { emoji: '🌿', label: 'Check-ins feitos',      val: `${stats.checkinsThisWeek}/7`,        color: Colors.purple  },
          { emoji: '🔥', label: 'Melhor dia',            val: stats.bestDay.xp > 0 ? stats.bestDay.day : '—', color: Colors.red },
        ].map(stat => (
          <View key={stat.label} style={s.statCard}>
            <Text style={s.statEmoji}>{stat.emoji}</Text>
            <Text style={[s.statVal, { color: stat.color }]}>{stat.val}</Text>
            <Text style={s.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Gráfico de XP por dia */}
      <View style={s.card}>
        <Text style={s.cardTitle}>XP por dia</Text>
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
                  {d.day}
                </Text>
              </View>
            )
          })}
        </View>
      </View>

      {/* Comparativo de streaks */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Evolução</Text>
        {[
          { label: 'Sequência atual',   val: `${progress.streak ?? 0} dias`,          bar: Math.min((progress.streak ?? 0) / 30, 1), color: Colors.orange },
          { label: 'Melhor sequência',  val: `${progress.longestStreak ?? 0} dias`,   bar: Math.min((progress.longestStreak ?? 0) / 30, 1), color: Colors.teal },
          { label: 'Aderência geral',   val: `${progress.adherencePercent ?? 0}%`,    bar: (progress.adherencePercent ?? 0) / 100, color: Colors.accent },
        ].map(item => (
          <View key={item.label} style={s.progressRow}>
            <View style={s.progressLabelRow}>
              <Text style={s.progressLabel}>{item.label}</Text>
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
        <Text style={s.cardTitle}>🎯 Desafio da próxima semana</Text>
        <View style={s.challengeRow}>
          <Text style={s.challengeEmoji}>💪</Text>
          <Text style={s.challengeText}>
            {stats.workoutsDone < 3
              ? `Complete ${3 - stats.workoutsDone} treinos a mais que esta semana`
              : 'Mantenha a consistência — você está no ritmo certo!'}
          </Text>
        </View>
        <View style={s.challengeRow}>
          <Text style={s.challengeEmoji}>📸</Text>
          <Text style={s.challengeText}>
            {stats.adherence < 80
              ? 'Registre pelo menos 80% das refeições do plano'
              : 'Continue registrando as refeições com a câmera'}
          </Text>
        </View>
        <View style={s.challengeRow}>
          <Text style={s.challengeEmoji}>💧</Text>
          <Text style={s.challengeText}>Beba 2L de água por dia e registre na Home</Text>
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
