import React, { useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Animated,
} from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius, MOODS } from '@constants/index'
import { MOOD_COLORS, SHADOWS } from '@constants/theme'
import {
  useUserStore, useNutritionStore,
  useProgressStore, useWorkoutStore,
} from '@store/index'
import { useDailyStore } from '@store/dailyStore'
import { getGreeting, getMoodAdaptationMessage, gText } from '@utils/index'
import { HomeSkeleton } from '@components/ui/Skeleton'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { MoodType } from '@/types/index'

export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const { user, isLoading }           = useUserStore()
  const { getTodayTotals, weekPlan }  = useNutritionStore()
  const { progress, getRankProgress, logCheckin, getTodayCheckin, addXp } = useProgressStore()
  const { getTodayWorkout }           = useWorkoutStore()
  const { hydrationMl, addHydration, resetIfNewDay } = useDailyStore()

  const xpAnim  = useRef(new Animated.Value(0)).current
  const calAnim = useRef(new Animated.Value(0)).current

  const totals       = getTodayTotals()
  const todayWorkout = getTodayWorkout()
  const todayPlan    = weekPlan.find(d => d.date === new Date().toISOString().split('T')[0])
  const checkin      = getTodayCheckin()
  const moodCalAdj   = checkin?.adaptations?.caloriesAdjusted ?? 0
  const targetCal    = (todayPlan?.targetMacros?.calories ?? 1650) + moodCalAdj
  const calPercent   = Math.min((totals.calories / targetCal) * 100, 100)
  const { current: rank, next, percent: xpPercent } = getRankProgress()
  const hydrationL   = (hydrationMl / 1000).toFixed(1)

  useEffect(() => {
    resetIfNewDay()

    Animated.spring(xpAnim, {
      toValue: xpPercent / 100,
      tension: 50, friction: 8, useNativeDriver: false,
    }).start()
    Animated.spring(calAnim, {
      toValue: calPercent / 100,
      tension: 50, friction: 8, useNativeDriver: false,
    }).start()
  }, [calPercent, xpPercent, checkin])

  const xpBarWidth = xpAnim.interpolate({ inputRange: [0,1], outputRange: ['0%','100%'] })
  const calBarWidth = calAnim.interpolate({ inputRange: [0,1], outputRange: ['0%','100%'] })

  const handleCheckin = async (mood: MoodType) => {
    if (!user) return
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const moodData = MOODS.find(m => m.id === mood)!
    const isFirstCheckin = !checkin  // XP só na primeira seleção do dia
    logCheckin(mood, moodData.emoji, user.id)
    if (isFirstCheckin) addXp('CHECKIN_DONE')
  }

  if (isLoading) return <HomeSkeleton />
  if (!user)     return <HomeSkeleton />

  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>{getGreeting(user.gender, user.name)}</Text>
          <Text style={s.headerSub}>
            {(progress.streak ?? 0) > 0
              ? `${progress.streak} dias seguidos 🔥`
              : 'Comece sua sequência hoje!'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
          <LinearGradient
            colors={['#E8FF80', '#C8F060']}
            style={s.avatar}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <Text style={s.avatarText}>{(user.name ?? '?').charAt(0).toUpperCase()}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <View style={s.statsRow}>
        {[
          { label: 'kcal',       value: totals.calories.toLocaleString('pt-BR'), color: Colors.accent  },
          { label: 'hidratação', value: `${hydrationL}L`,                        color: Colors.teal,
            onPress: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); addHydration(200) } },
          { label: 'dias ativos',value: String(progress.activeDays ?? 0),        color: Colors.purple  },
          { label: 'streak',     value: `🔥 ${progress.streak ?? 0}`,            color: Colors.orange  },
        ].map(stat => (
          <TouchableOpacity
            key={stat.label}
            style={s.statBox}
            onPress={stat.onPress}
            activeOpacity={stat.onPress ? 0.7 : 1}
          >
            <Text style={[s.statVal, { color: stat.color }]}>{stat.value}</Text>
            <Text style={s.statLbl}>{stat.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Hint de hidratação */}
      {hydrationMl === 0 && (
        <TouchableOpacity
          style={s.hydraHint}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); addHydration(200) }}
        >
          <Text style={s.hydraHintText}>💧 Toque em hidratação para registrar +200ml</Text>
        </TouchableOpacity>
      )}

      {/* Card principal — Calorias com gradiente */}
      <LinearGradient colors={['#0F2010','#0A0A0A']} style={[s.card, s.calCard]} start={{x:0,y:0}} end={{x:1,y:1}}>
        <View style={s.calHeader}>
          <View>
            <Text style={s.calLabel}>Calorias hoje</Text>
            <View style={s.calValues}>
              <Text style={s.calNum}>{totals.calories.toLocaleString('pt-BR')}</Text>
              <Text style={s.calTarget}> / {targetCal.toLocaleString('pt-BR')} kcal</Text>
            </View>
          </View>
          <Text style={s.calPct}>{Math.round(calPercent)}%</Text>
        </View>
        {/* Barra animada */}
        <View style={s.calBarTrack}>
          <Animated.View style={[s.calBarFill, { width: calBarWidth }]} />
        </View>
        {/* Macros */}
        <View style={s.macroRow}>
          {[
            { label: 'Proteína', val: `${totals.protein}g`, color: Colors.purple },
            { label: 'Carboidrato', val: `${totals.carbs}g`, color: Colors.teal },
            { label: 'Gordura', val: `${totals.fat}g`, color: Colors.orange },
          ].map(m => (
            <View key={m.label} style={s.macroPill}>
              <Text style={[s.macroVal, { color: m.color }]}>{m.val}</Text>
              <Text style={s.macroLbl}>{m.label}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={s.scanShortcut} onPress={() => router.push('/(tabs)/scan')}>
          <Text style={s.scanShortcutText}>📸 Registrar refeição</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* XP & Rank */}
      <TouchableOpacity onPress={() => router.push('/(tabs)/ranks')} activeOpacity={0.85}>
        <LinearGradient colors={['#100D20','#0A0A0A']} style={s.card} start={{x:0,y:0}} end={{x:1,y:1}}>
          <View style={s.rankRow}>
            <Text style={s.rankEmoji}>{rank.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.rankLabel}>{rank.label}</Text>
              <Text style={s.rankXp}>
                {(progress.totalXp ?? 0).toLocaleString('pt-BR')} XP
                {next ? ` · faltam ${(next.minXp - (progress.totalXp ?? 0)).toLocaleString('pt-BR')}` : ''}
              </Text>
              <View style={s.xpTrack}>
                <Animated.View style={[s.xpFill, { width: xpBarWidth }]} />
              </View>
            </View>
            {next && (
              <View style={s.nextRankWrap}>
                <Text style={s.nextRankEmoji}>{next.emoji}</Text>
                <Text style={s.nextRankLabel}>próximo</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Coach IA */}
      <TouchableOpacity onPress={() => router.push('/(tabs)/coach')} activeOpacity={0.85}>
        <LinearGradient colors={['#0D1020','#0A0A0A']} style={[s.card, s.coachCard]} start={{x:0,y:0}} end={{x:1,y:1}}>
          <View style={s.coachIconWrap}>
            <Text style={s.coachIconEmoji}>🧠</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.coachTitle}>Coach de IA</Text>
            <Text style={s.coachSub}>Tire dúvidas sobre nutrição, treinos e saúde</Text>
          </View>
          <Text style={s.coachArrow}>›</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Treino do dia */}
      {todayWorkout && (
        <View style={[s.card, SHADOWS.sm]}>
          <View style={s.cardRowBetween}>
            <Text style={s.cardTitle}>💪 Treino de hoje</Text>
            <View style={s.badge}><Text style={s.badgeText}>Hoje</Text></View>
          </View>
          <View style={s.workoutRow}>
            <LinearGradient colors={['#1A1030','#111']} style={s.workoutIcon}>
              <Text style={{ fontSize: 20 }}>🏋️</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={s.workoutTitle}>{todayWorkout.title}</Text>
              <Text style={s.workoutSub}>
                {todayWorkout.blocks.reduce((a,b) => a+(b.exercises?.length ?? 0), 0)} exercícios
                · ~{todayWorkout.estimatedDuration} min
              </Text>
            </View>
            <TouchableOpacity style={s.startBtn} onPress={() => router.push('/(tabs)/workout')}>
              <Text style={s.startBtnText}>Iniciar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Refeições */}
      <View style={[s.card, SHADOWS.sm]}>
        <View style={s.cardRowBetween}>
          <Text style={s.cardTitle}>🥗 Refeições</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/diet')}>
            <Text style={s.linkText}>Ver plano →</Text>
          </TouchableOpacity>
        </View>
        {todayPlan?.meals.map(meal => (
          <View key={meal.type} style={[s.mealRow, { opacity: meal.completed ? 1 : 0.6 }]}>
            <Text style={s.mealEmoji}>
              {meal.type === 'breakfast' ? '☕' : meal.type === 'lunch' ? '🍗' : meal.type === 'dinner' ? '🐟' : '🍎'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={s.mealName}>
                {meal.type === 'breakfast' ? 'Café' : meal.type === 'lunch' ? 'Almoço' : meal.type === 'dinner' ? 'Jantar' : 'Lanche'}
              </Text>
              <Text style={s.mealSub}>{meal.foods.slice(0,2).map(f => f.name).join(', ')}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.mealCal}>{meal.totalMacros.calories} kcal</Text>
              {meal.completed
                ? <Text style={s.mealDone}>✓</Text>
                : <TouchableOpacity onPress={() => router.push('/(tabs)/scan')}>
                    <Text style={s.mealScan}>📸</Text>
                  </TouchableOpacity>}
            </View>
          </View>
        ))}
        {(!todayPlan || todayPlan.meals.length === 0) && (
          <Text style={s.emptyText}>Plano não gerado. Acesse Dieta para criar.</Text>
        )}
      </View>

      {/* Relatório semanal */}
      <TouchableOpacity onPress={() => router.push('/(tabs)/report')} activeOpacity={0.85}>
        <LinearGradient colors={['#0A1020','#0A0A0A']} style={[s.card, s.reportCard]} start={{x:0,y:0}} end={{x:1,y:1}}>
          <Text style={s.reportIcon}>📊</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.reportTitle}>Relatório semanal</Text>
            <Text style={s.reportSub}>Veja sua evolução detalhada desta semana</Text>
          </View>
          <Text style={s.reportArrow}>›</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Check-in emocional */}
      <View style={[s.card, SHADOWS.sm]}>
        <View style={s.cardRowBetween}>
          <Text style={s.cardTitle}>Check-in emocional</Text>
          {checkin
            ? <View style={s.checkinBadgeDone}>
                <Text style={s.checkinBadgeDoneText}>{checkin.moodEmoji} feito</Text>
              </View>
            : <View style={s.checkinBadgePending}>
                <Text style={s.checkinBadgePendingText}>Pendente</Text>
              </View>}
        </View>

        <Text style={s.checkinSub}>
          Como {gText(user.gender, { masc: 'você está', fem: 'você está', neu: 'você está' })} agora?
        </Text>

        <View style={s.moodRow}>
          {MOODS.map(m => {
            const mc         = MOOD_COLORS[m.id]
            const isSelected = checkin?.mood === m.id
            return (
              <TouchableOpacity
                key={m.id}
                style={[
                  s.moodBtn,
                  { backgroundColor: mc.bg, borderColor: mc.border },
                  isSelected && s.moodBtnSelected,
                ]}
                onPress={() => handleCheckin(m.id as MoodType)}
              >
                <Text style={s.moodEmoji}>{m.emoji}</Text>
                <Text style={[s.moodLabel, { color: mc.text }]}>{m.label}</Text>
                {isSelected && <Text style={s.moodCheck}>✓</Text>}
              </TouchableOpacity>
            )
          })}
        </View>

        {checkin && (
          <Text style={[s.checkinDoneText, { marginTop: 10 }]}>
            {getMoodAdaptationMessage(user.gender, checkin.mood)}
          </Text>
        )}
      </View>

    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:              { flex: 1, backgroundColor: Colors.bg },
  content:           { padding: Spacing[5], paddingBottom: 100 },
  header:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  greeting:          { fontSize: 22, fontWeight: '800', color: Colors.text },
  headerSub:         { fontSize: 13, color: Colors.text2, marginTop: 2 },
  avatar:            { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText:        { fontSize: 16, fontWeight: '800', color: '#0A0A0A' },
  statsRow:          { flexDirection: 'row', gap: 8, marginBottom: 10 },
  statBox:           { flex: 1, backgroundColor: Colors.bg3, borderRadius: Radius.md, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statVal:           { fontSize: 14, fontWeight: '700' },
  statLbl:           { fontSize: 8, color: Colors.text2, marginTop: 2, textAlign: 'center' },
  hydraHint:         { backgroundColor: Colors.teal + '12', borderRadius: Radius.md, padding: 9, marginBottom: 10, borderWidth: 1, borderColor: Colors.teal + '30', alignItems: 'center' },
  hydraHintText:     { fontSize: 12, color: Colors.teal },
  card:              { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  calCard:           { borderColor: '#1A3020' },
  calHeader:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  calLabel:          { fontSize: 11, color: Colors.text2, marginBottom: 3 },
  calValues:         { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  calNum:            { fontSize: 28, fontWeight: '800', color: Colors.accent },
  calTarget:         { fontSize: 13, color: Colors.text2 },
  calPct:            { fontSize: 20, fontWeight: '700', color: Colors.accent + '80' },
  calBarTrack:       { height: 5, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden', marginBottom: 12, flexDirection: 'row' },
  calBarFill:        { height: '100%', backgroundColor: Colors.accent, borderRadius: 3 },
  macroRow:          { flexDirection: 'row', gap: 8, marginBottom: 12 },
  macroPill:         { flex: 1, backgroundColor: Colors.bg + '80', borderRadius: 10, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  macroVal:          { fontSize: 14, fontWeight: '700' },
  macroLbl:          { fontSize: 9, color: Colors.text2, marginTop: 1 },
  scanShortcut:      { backgroundColor: Colors.accent + '15', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.accent + '30' },
  scanShortcutText:  { fontSize: 13, fontWeight: '600', color: Colors.accent },
  rankRow:           { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rankEmoji:         { fontSize: 38 },
  rankLabel:         { fontSize: 16, fontWeight: '800', color: Colors.text },
  rankXp:            { fontSize: 11, color: Colors.text2, marginTop: 1, marginBottom: 6 },
  xpTrack:           { height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden', flexDirection: 'row' },
  xpFill:            { backgroundColor: Colors.accent, borderRadius: 2 },
  nextRankWrap:      { alignItems: 'center' },
  nextRankEmoji:     { fontSize: 22, opacity: 0.5 },
  nextRankLabel:     { fontSize: 9, color: Colors.text3, marginTop: 2 },
  cardRowBetween:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle:         { fontSize: 14, fontWeight: '600', color: Colors.text },
  badge:             { backgroundColor: Colors.purple + '22', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: Colors.purple + '44' },
  badgeText:         { fontSize: 10, fontWeight: '600', color: Colors.purple },
  linkText:          { fontSize: 12, color: Colors.accent },
  workoutRow:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  workoutIcon:       { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  workoutTitle:      { fontSize: 14, fontWeight: '600', color: Colors.text },
  workoutSub:        { fontSize: 11, color: Colors.text2, marginTop: 1 },
  startBtn:          { backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  startBtnText:      { fontSize: 12, fontWeight: '700', color: Colors.bg },
  mealRow:           { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  mealEmoji:         { fontSize: 22, width: 32, textAlign: 'center' },
  mealName:          { fontSize: 13, fontWeight: '600', color: Colors.text },
  mealSub:           { fontSize: 11, color: Colors.text2, marginTop: 1 },
  mealCal:           { fontSize: 13, fontWeight: '700', color: Colors.accent },
  mealDone:          { fontSize: 14, color: Colors.teal },
  mealScan:          { fontSize: 16 },
  emptyText:         { fontSize: 13, color: Colors.text2, textAlign: 'center', paddingVertical: 10 },
  reportCard:        { flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: '#101828' },
  reportIcon:        { fontSize: 28 },
  reportTitle:       { fontSize: 14, fontWeight: '600', color: Colors.text },
  reportSub:         { fontSize: 12, color: Colors.text2, marginTop: 2 },
  reportArrow:       { fontSize: 20, color: Colors.text3 },
  checkinBadgeDone:  { backgroundColor: Colors.teal + '22', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: Colors.teal + '44' },
  checkinBadgeDoneText: { fontSize: 10, fontWeight: '600', color: Colors.teal },
  checkinBadgePending:  { backgroundColor: Colors.orange + '22', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: Colors.orange + '44' },
  checkinBadgePendingText: { fontSize: 10, fontWeight: '600', color: Colors.orange },
  checkinSub:        { fontSize: 13, color: Colors.text2, marginBottom: 10 },
  moodRow:           { flexDirection: 'row', gap: 6 },
  moodBtn:           { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1 },
  moodBtnSelected:   { borderWidth: 2.5 },
  moodEmoji:         { fontSize: 20 },
  moodLabel:         { fontSize: 9, fontWeight: '600', marginTop: 3 },
  moodCheck:         { fontSize: 8, fontWeight: '800', color: Colors.text2, marginTop: 2 },
  checkinDoneText:   { fontSize: 13, color: Colors.text2, lineHeight: 18 },
  coachCard:         { flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: '#151830' },
  coachIconWrap:     { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.purple + '33', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.purple + '44' },
  coachIconEmoji:    { fontSize: 22 },
  coachTitle:        { fontSize: 14, fontWeight: '700', color: Colors.text },
  coachSub:          { fontSize: 11, color: Colors.text2, marginTop: 2 },
  coachArrow:        { fontSize: 20, color: Colors.text3 },
})
