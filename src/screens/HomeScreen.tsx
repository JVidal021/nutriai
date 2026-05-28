import React, { useEffect, useRef, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Animated,
} from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle } from 'react-native-svg'
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
import type { MoodType, WorkoutSession } from '@/types/index'
import { useT } from '@/i18n/useT'

// ─── Ring progress card ──────────────────────────────────────────────────────
const RING_R = 26
const RING_C = 2 * Math.PI * RING_R // ≈ 163.4

interface RingCardProps {
  label: string
  value: string
  percent: number
  color: string
  icon: string
  centerText: string
  hint?: string
  onPress?: () => void
}

function RingCard({ label, value, percent, color, icon, centerText, hint, onPress }: RingCardProps) {
  const offset = RING_C * (1 - Math.min(percent, 100) / 100)
  return (
    <TouchableOpacity style={s.ringCard} onPress={onPress} activeOpacity={onPress ? 0.75 : 1}>
      <View style={s.ringWrap}>
        {/* SVG ring rotated so 0% starts at top */}
        <Svg width={64} height={64} style={s.ringSvg}>
          <Circle cx={32} cy={32} r={RING_R} fill="none" stroke="#222" strokeWidth={6} />
          <Circle
            cx={32} cy={32} r={RING_R} fill="none"
            stroke={color} strokeWidth={6}
            strokeDasharray={`${RING_C} ${RING_C}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </Svg>
        <View style={s.ringCenter}>
          <Text style={[s.ringPct, { color }]}>{centerText}</Text>
          <Text style={s.ringIcon}>{icon}</Text>
        </View>
      </View>
      <Text style={s.ringLabel}>{label}</Text>
      <Text style={s.ringValue}>{value}</Text>
      {hint ? <Text style={s.ringHint}>{hint}</Text> : null}
    </TouchableOpacity>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Chaves de tradução dos dias: Mon=0…Sun=6
const WEEK_DAY_KEYS = ['days_short.mon','days_short.tue','days_short.wed','days_short.thu','days_short.fri','days_short.sat','days_short.sun']

function buildCurrentWeek(streak: number, checkedInToday: boolean) {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  // Offset para chegar na segunda-feira da semana atual
  const dow = today.getDay() // 0=Dom…6=Sáb
  const mondayOffset = dow === 0 ? 6 : dow - 1
  const monday = new Date(today)
  monday.setDate(today.getDate() - mondayOffset)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dStr = d.toISOString().split('T')[0]
    const isToday = dStr === todayStr
    const isFuture = dStr > todayStr
    const daysAgo = Math.round((today.getTime() - d.getTime()) / 86400000)
    const done = isToday
      ? checkedInToday
      : !isFuture && daysAgo > 0 && daysAgo <= streak
    return { labelKey: WEEK_DAY_KEYS[i], done, isToday, isFuture }
  })
}

const MUSCLE_PT: Record<string, string> = {
  chest:     'Peito',
  back:      'Costas',
  shoulders: 'Ombros',
  biceps:    'Bíceps',
  triceps:   'Tríceps',
  legs:      'Pernas',
  glutes:    'Glúteos',
  core:      'Core',
  cardio:    'Cardio',
  mobility:  'Mobilidade',
  arms:      'Braços',
}

function getMuscleChips(workout: WorkoutSession | undefined): string[] {
  if (!workout) return []
  if (workout.muscleGroups?.length)
    return workout.muscleGroups.slice(0, 4).map(g => MUSCLE_PT[g] ?? g)
  // fallback: collect from block titles
  return [...new Set(workout.blocks.map(b => b.title).filter(Boolean))].slice(0, 4)
}

function buildInsight(streak: number, calPercent: number, workoutDone: boolean): string {
  if (streak >= 7 && workoutDone)
    return `${streak} dias seguidos! 🎉 Amanhã considere descanso ativo — caminhada leve ajuda na recuperação.`
  if (streak >= 3)
    return `${streak} dias de sequência! Continue assim, você está construindo um hábito sólido. 💪`
  if (workoutDone && calPercent >= 70)
    return `Treino feito e alimentação no ponto! Dia produtivo. Não esqueça de hidratar. 💧`
  if (calPercent < 25)
    return `Você mal começou a se alimentar hoje. Lembre-se: nutrição é tão importante quanto o treino. 🥗`
  if (calPercent > 95)
    return `Meta calórica quase atingida! Atenção para não ultrapassar — prefira proteínas no final do dia.`
  return `Foco no processo. Cada pequena ação de hoje é um investimento no seu resultado amanhã. 🌱`
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const { t } = useT()
  const { user, isLoading }           = useUserStore()
  const { getTodayTotals, weekPlan }  = useNutritionStore()
  const { progress, getRankProgress, logCheckin, getTodayCheckin, addXp } = useProgressStore()
  const { weekWorkouts }              = useWorkoutStore()
  const { hydrationMl, addHydration, resetIfNewDay } = useDailyStore()

  const xpAnim  = useRef(new Animated.Value(0)).current
  const calAnim = useRef(new Animated.Value(0)).current

  const todayStr      = new Date().toISOString().split('T')[0]
  const totals        = getTodayTotals()
  // Use weekWorkouts directly so we see completed workouts too
  const todayWorkout  = weekWorkouts.find(w => w.date === todayStr) as WorkoutSession | undefined
  const todayPlan     = weekPlan.find(d => d.date === todayStr)
  const checkin       = getTodayCheckin()
  const moodCalAdj    = checkin?.adaptations?.caloriesAdjusted ?? 0
  const targetCal     = (todayPlan?.targetMacros?.calories ?? 1650) + moodCalAdj
  const calPercent    = Math.min((totals.calories / targetCal) * 100, 100)
  const hydPercent    = Math.min((hydrationMl / 2500) * 100, 100)
  const hydrationL    = (hydrationMl / 1000).toFixed(1)
  const workoutDone   = !!(todayWorkout?.completed)
  const streak        = progress.streak ?? 0
  const { current: rank, next, percent: xpPercent } = getRankProgress()

  const muscleChips = useMemo(() => getMuscleChips(todayWorkout), [todayWorkout])
  const last7Days   = useMemo(() => buildCurrentWeek(streak, !!checkin), [streak, checkin])
  const aiInsight   = useMemo(() => buildInsight(streak, calPercent, workoutDone), [streak, calPercent, workoutDone])

  useEffect(() => {
    resetIfNewDay()
    Animated.spring(xpAnim,  { toValue: xpPercent / 100, tension: 50, friction: 8, useNativeDriver: false }).start()
    Animated.spring(calAnim, { toValue: calPercent / 100, tension: 50, friction: 8, useNativeDriver: false }).start()
  }, [calPercent, xpPercent, checkin])

  const xpBarWidth = xpAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })

  const handleCheckin = async (mood: MoodType) => {
    if (!user) return
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const moodData = MOODS.find(m => m.id === mood)!
    const isFirst  = !checkin
    logCheckin(mood, moodData.emoji, user.id)
    if (isFirst) addXp('CHECKIN_DONE')
  }

  if (isLoading || !user) return <HomeSkeleton />

  const greeting = getGreeting(user.gender, user.name)
  const totalExercises = todayWorkout?.blocks.reduce((a, b) => a + ((b.exercises as any[])?.length ?? 0), 0) ?? 0

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
    >

      {/* ── HERO CARD ─────────────────────────────────────── */}
      <LinearGradient
        colors={['#0d1f00', '#162800', '#1a3300']}
        style={s.heroCard}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <Text style={s.heroGreeting}>{greeting.split(',')[0]}</Text>
        <Text style={s.heroName}>{user.name} 👋</Text>
        <View style={s.heroInsightBox}>
          <Text style={s.heroInsightText}>
            <Text style={s.heroInsightLabel}>{t('home.insight_label')} </Text>
            {aiInsight}
          </Text>
        </View>
      </LinearGradient>

      {/* ── RINGS ─────────────────────────────────────────── */}
      <View style={s.ringsRow}>
        <RingCard
          label={t('home.calories')}
          value={`${totals.calories.toLocaleString()} kcal`}
          percent={calPercent}
          color={Colors.accent}
          icon="🔥"
          centerText={`${Math.round(calPercent)}%`}
        />
        <RingCard
          label={t('home.hydration')}
          value={`${hydrationL} / 2.5L`}
          percent={hydPercent}
          color={Colors.teal}
          icon="💧"
          centerText={`${Math.round(hydPercent)}%`}
          hint={t('home.hydration_hint')}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); addHydration(200) }}
        />
        <RingCard
          label={t('home.workout_ring')}
          value={workoutDone ? t('home.workout_done') : t('home.workout_pending')}
          percent={workoutDone ? 100 : 0}
          color={Colors.purple}
          icon="💪"
          centerText={workoutDone ? '✓' : '–'}
        />
      </View>

      {/* ── TREINO DO DIA ─────────────────────────────────── */}
      {todayWorkout && (
        <View style={[s.card, SHADOWS.sm]}>
          <View style={s.cardRowBetween}>
            <Text style={s.cardTitle}>{t('home.workout_today')}</Text>
            <View style={s.badge}>
              <Text style={s.badgeText}>{todayWorkout.estimatedDuration} min</Text>
            </View>
          </View>

          {/* Muscle chips */}
          {muscleChips.length > 0 && (
            <View style={s.chipsRow}>
              {muscleChips.map(chip => (
                <View key={chip} style={s.chip}>
                  <Text style={s.chipText}>{chip}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={s.workoutMeta}>
            {t(totalExercises === 1 ? 'home.exercises_count_one' : 'home.exercises_count_other', { count: totalExercises })} · ~{todayWorkout.estimatedDuration} {t('common.min')}
          </Text>

          <TouchableOpacity
            style={[s.startBtnFull, workoutDone && s.startBtnDone]}
            onPress={() => router.push('/(tabs)/workout')}
          >
            <Text style={[s.startBtnFullText, workoutDone && s.startBtnDoneText]}>
              {workoutDone ? t('home.workout_completed') : t('home.start_workout')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── STREAK ────────────────────────────────────────── */}
      <View style={[s.card, SHADOWS.sm]}>
        <View style={s.streakTop}>
          <View>
            <Text style={s.cardTitle}>{t('home.streak_title')}</Text>
            <View style={s.streakNumRow}>
              <Text style={s.streakNum}>{streak}</Text>
              <Text style={s.streakUnit}> {t('home.streak_unit')}</Text>
            </View>
          </View>
          <Text style={s.streakRecord}>
            {t('home.streak_record')} <Text style={s.streakRecordVal}>{(progress as any).bestStreak ?? streak} {t('home.streak_unit')}</Text>
          </Text>
        </View>
        <View style={s.daysRow}>
          {last7Days.map((day, i) => (
            <View
              key={i}
              style={[
                s.dayBox,
                day.isToday ? s.dayToday : day.done ? s.dayDone : day.isFuture ? s.dayFuture : s.dayMissed,
              ]}
            >
              <Text style={[
                s.dayLbl,
                day.isToday && s.dayLblToday,
                !day.isToday && !day.done && !day.isFuture && s.dayLblMissed,
                day.isFuture && s.dayLblFuture,
              ]}>
                {t(day.labelKey as any)}
              </Text>
              <View style={[s.dayDot, day.isToday && s.dayDotToday, day.done && !day.isToday && s.dayDotDone]} />
            </View>
          ))}
        </View>
      </View>

      {/* ── RANK ──────────────────────────────────────────── */}
      <TouchableOpacity onPress={() => router.push('/(tabs)/ranks')} activeOpacity={0.85}>
        <LinearGradient colors={['#100D20', '#0A0A0A']} style={[s.card, s.rankCard]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={s.rankEmoji}>{rank.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.rankLabel}>{rank.label}</Text>
            <Text style={s.rankXp}>
              {(progress.totalXp ?? 0).toLocaleString('pt-BR')} XP
              {next ? ` · +${(next.minXp - (progress.totalXp ?? 0)).toLocaleString()} para ${next.label}` : ''}
            </Text>
            <View style={s.xpTrack}>
              <Animated.View style={[s.xpFill, { width: xpBarWidth }]} />
            </View>
            {next && <Text style={s.rankNext}>{t('home.rank_next')} {next.label}</Text>}
          </View>
          <Text style={s.rankArrow}>›</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* ── REFEIÇÕES ─────────────────────────────────────── */}
      <View style={[s.card, SHADOWS.sm]}>
        <View style={s.cardRowBetween}>
          <Text style={s.cardTitle}>{t('home.meals_today')}</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/diet')}>
            <Text style={s.linkText}>{t('home.see_plan')}</Text>
          </TouchableOpacity>
        </View>
        {todayPlan?.meals.map(meal => (
          <View key={meal.type} style={[s.mealRow, { opacity: meal.completed ? 1 : 0.6 }]}>
            <Text style={s.mealEmoji}>
              {meal.type === 'breakfast' ? '🍳' : meal.type === 'lunch' ? '🍗' : meal.type === 'dinner' ? '🐟' : '🍎'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={s.mealName}>
                {t(`meals.${meal.type}` as any)}
              </Text>
              <Text style={s.mealSub}>{meal.foods.slice(0, 2).map(f => f.name).join(', ')}</Text>
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
          <Text style={s.emptyText}>{t('home.no_plan')}</Text>
        )}
      </View>

      {/* ── COACH IA ──────────────────────────────────────── */}
      <TouchableOpacity onPress={() => router.push('/(tabs)/coach')} activeOpacity={0.85}>
        <LinearGradient colors={['#0D1020', '#0A0A0A']} style={[s.card, s.coachCard]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={s.coachIconWrap}>
            <Text style={s.coachIconEmoji}>🧠</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.coachTitle}>{t('home.coach_title')}</Text>
            <Text style={s.coachSub}>{t('home.coach_sub')}</Text>
          </View>
          <Text style={s.coachArrow}>›</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* ── CHECK-IN EMOCIONAL ────────────────────────────── */}
      <View style={[s.card, SHADOWS.sm]}>
        <View style={s.cardRowBetween}>
          <Text style={s.cardTitle}>{t('home.checkin_title')}</Text>
          {checkin
            ? <View style={s.checkinBadgeDone}><Text style={s.checkinBadgeDoneText}>{checkin.moodEmoji} {t('home.checkin_done')}</Text></View>
            : <View style={s.checkinBadgePending}><Text style={s.checkinBadgePendingText}>{t('home.checkin_pending')}</Text></View>}
        </View>
        <Text style={s.checkinSub}>
          {t('home.checkin_question')}
        </Text>
        <View style={s.moodRow}>
          {MOODS.map(m => {
            const mc = MOOD_COLORS[m.id]
            const isSelected = checkin?.mood === m.id
            return (
              <TouchableOpacity
                key={m.id}
                style={[s.moodBtn, { backgroundColor: mc.bg, borderColor: mc.border }, isSelected && s.moodBtnSelected]}
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

      {/* ── RELATÓRIO ─────────────────────────────────────── */}
      <TouchableOpacity onPress={() => router.push('/(tabs)/report')} activeOpacity={0.85}>
        <LinearGradient colors={['#0A1020', '#0A0A0A']} style={[s.card, s.reportCard]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={s.reportIcon}>📊</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.reportTitle}>{t('home.report_title')}</Text>
            <Text style={s.reportSub}>{t('home.report_sub')}</Text>
          </View>
          <Text style={s.reportArrow}>›</Text>
        </LinearGradient>
      </TouchableOpacity>

    </ScrollView>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing[4], paddingBottom: 100 },

  // Hero
  heroCard:       { borderRadius: 24, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(200,240,96,.2)' },
  heroGreeting:   { fontSize: 13, color: 'rgba(200,240,96,.7)', marginBottom: 2 },
  heroName:       { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 14 },
  heroInsightBox: { backgroundColor: 'rgba(200,240,96,.08)', borderRadius: 10, padding: 10, borderLeftWidth: 3, borderLeftColor: Colors.accent },
  heroInsightText:{ fontSize: 13, color: 'rgba(200,240,96,.85)', lineHeight: 20 },
  heroInsightLabel:{ fontWeight: '700' },

  // Rings
  ringsRow:  { flexDirection: 'row', gap: 10, marginBottom: 12 },
  ringCard:  { flex: 1, backgroundColor: Colors.bg2, borderRadius: 18, padding: 12, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.border },
  ringWrap:  { width: 64, height: 64, position: 'relative' },
  ringSvg:   { position: 'absolute', top: 0, left: 0, transform: [{ rotate: '-90deg' }] },
  ringCenter:{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' } as any,
  ringPct:   { fontSize: 13, fontWeight: '800', lineHeight: 15 },
  ringIcon:  { fontSize: 10, lineHeight: 12 },
  ringLabel: { fontSize: 10, color: Colors.text2, fontWeight: '600' },
  ringValue: { fontSize: 11, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  ringHint:  { fontSize: 9, color: Colors.teal, textAlign: 'center', marginTop: 2, opacity: 0.8 },

  // Card base
  card:            { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  cardRowBetween:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle:       { fontSize: 13, fontWeight: '700', color: Colors.text2, textTransform: 'uppercase', letterSpacing: 0.6 },
  badge:           { backgroundColor: 'rgba(200,240,96,.12)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(200,240,96,.3)' },
  badgeText:       { fontSize: 11, fontWeight: '700', color: Colors.accent },
  linkText:        { fontSize: 12, color: Colors.accent, fontWeight: '600' },

  // Workout
  chipsRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip:           { backgroundColor: 'rgba(200,240,96,.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(200,240,96,.25)' },
  chipText:       { fontSize: 11, fontWeight: '700', color: Colors.accent },
  workoutMeta:    { fontSize: 11, color: Colors.text3, marginBottom: 12 },
  startBtnFull:     { backgroundColor: Colors.accent, borderRadius: 12, padding: 13, alignItems: 'center' },
  startBtnFullText: { fontSize: 14, fontWeight: '800', color: Colors.bg, letterSpacing: 0.3 },
  startBtnDone:     { backgroundColor: 'rgba(45,212,170,.15)', borderWidth: 1, borderColor: Colors.teal },
  startBtnDoneText: { color: Colors.teal },

  // Streak
  streakTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  streakNumRow:    { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  streakNum:       { fontSize: 28, fontWeight: '900', color: Colors.accent },
  streakUnit:      { fontSize: 13, color: Colors.text2 },
  streakRecord:    { fontSize: 12, color: Colors.text2, textAlign: 'right', marginTop: 4 },
  streakRecordVal: { color: Colors.accent, fontWeight: '700' },
  daysRow:         { flexDirection: 'row', gap: 6 },
  dayBox:          { flex: 1, aspectRatio: 1, borderRadius: 7, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayDone:         { backgroundColor: 'rgba(200,240,96,.2)', borderWidth: 1, borderColor: 'rgba(200,240,96,.4)' },
  dayToday:        { backgroundColor: Colors.accent },
  dayMissed:       { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  dayFuture:       { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border, opacity: 0.4 },
  dayLbl:          { fontSize: 9, fontWeight: '700', color: Colors.accent },
  dayLblToday:     { color: Colors.bg },
  dayLblMissed:    { color: Colors.text3 },
  dayLblFuture:    { color: Colors.text3 },
  dayDot:          { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  dayDotDone:      { backgroundColor: Colors.accent },
  dayDotToday:     { backgroundColor: Colors.bg },

  // Rank
  rankCard:    { flexDirection: 'row', alignItems: 'center', gap: 14, borderColor: 'rgba(155,89,182,.25)' },
  rankEmoji:   { fontSize: 40 },
  rankLabel:   { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  rankXp:      { fontSize: 11, color: Colors.text2, marginBottom: 6 },
  xpTrack:     { height: 5, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  xpFill:      { height: '100%', borderRadius: 3, backgroundColor: Colors.accent },
  rankNext:    { fontSize: 10, color: 'rgba(155,89,182,.8)', marginTop: 4 },
  rankArrow:   { fontSize: 22, fontWeight: '900', color: 'rgba(155,89,182,.7)' },

  // Meals
  mealRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  mealEmoji: { fontSize: 20, width: 32, textAlign: 'center' },
  mealName:  { fontSize: 13, fontWeight: '600', color: Colors.text },
  mealSub:   { fontSize: 11, color: Colors.text2, marginTop: 1 },
  mealCal:   { fontSize: 12, fontWeight: '700', color: Colors.accent },
  mealDone:  { fontSize: 13, color: Colors.teal },
  mealScan:  { fontSize: 16 },
  emptyText: { fontSize: 13, color: Colors.text2, textAlign: 'center', paddingVertical: 10 },

  // Coach
  coachCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: '#151830' },
  coachIconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colors.purple + '33', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.purple + '44' },
  coachIconEmoji:{ fontSize: 22 },
  coachTitle:    { fontSize: 14, fontWeight: '700', color: Colors.text },
  coachSub:      { fontSize: 11, color: Colors.text2, marginTop: 2 },
  coachArrow:    { fontSize: 20, color: Colors.text3 },

  // Check-in
  checkinBadgeDone:        { backgroundColor: Colors.teal + '22', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: Colors.teal + '44' },
  checkinBadgeDoneText:    { fontSize: 10, fontWeight: '600', color: Colors.teal },
  checkinBadgePending:     { backgroundColor: Colors.orange + '22', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: Colors.orange + '44' },
  checkinBadgePendingText: { fontSize: 10, fontWeight: '600', color: Colors.orange },
  checkinSub:              { fontSize: 13, color: Colors.text2, marginBottom: 10 },
  moodRow:                 { flexDirection: 'row', gap: 6 },
  moodBtn:                 { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1 },
  moodBtnSelected:         { borderWidth: 2.5 },
  moodEmoji:               { fontSize: 20 },
  moodLabel:               { fontSize: 9, fontWeight: '600', marginTop: 3 },
  moodCheck:               { fontSize: 8, fontWeight: '800', color: Colors.text2, marginTop: 2 },
  checkinDoneText:         { fontSize: 13, color: Colors.text2, lineHeight: 18 },

  // Report
  reportCard:  { flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: '#101828' },
  reportIcon:  { fontSize: 28 },
  reportTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  reportSub:   { fontSize: 12, color: Colors.text2, marginTop: 2 },
  reportArrow: { fontSize: 20, color: Colors.text3 },
})
