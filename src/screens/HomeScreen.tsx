import React, { useEffect, useRef, useMemo, useState } from 'react'
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

// Grade do mês atual: células null = espaços antes do dia 1 (alinhamento seg→dom)
type MonthCell = { d: number; dStr: string; isToday: boolean; isFuture: boolean } | null
function buildMonthGrid(ref: Date): MonthCell[] {
  const year = ref.getFullYear()
  const month = ref.getMonth()
  const first = new Date(year, month, 1)
  const startDow = (first.getDay() + 6) % 7 // segunda = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr = new Date().toISOString().split('T')[0]
  const cells: MonthCell[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ d, dStr, isToday: dStr === todayStr, isFuture: dStr > todayStr })
  }
  return cells
}

function getMuscleChips(workout: WorkoutSession | undefined): string[] {
  if (!workout) return []
  if (workout.muscleGroups?.length)
    return workout.muscleGroups.slice(0, 4) // raw IDs — translated inside component
  // fallback: collect from AI-generated block titles
  return [...new Set(workout.blocks.map(b => b.title).filter(Boolean))].slice(0, 4)
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const { t } = useT()
  const { user, isLoading }           = useUserStore()
  const { getTodayTotals, weekPlan }  = useNutritionStore()
  const { progress, xpHistory, getRankProgress, logCheckin, getTodayCheckin, addXp } = useProgressStore()
  const { weekWorkouts }              = useWorkoutStore()
  const { hydrationMl, addHydration, resetIfNewDay } = useDailyStore()

  // ─── i18n helpers ────────────────────────────────────────────────────────
  const getMoodLabel = (id: string): string => ({
    great:     t('moods.great' as any),
    good:      t('moods.good' as any),
    neutral:   t('moods.neutral' as any),
    tired:     t('moods.tired' as any),
    exhausted: t('moods.exhausted' as any),
  }[id] ?? id)

  const getMuscleLabel = (key: string): string => {
    const translated = t(`muscles.${key}` as any)
    return translated.startsWith('muscles.') ? key : translated
  }

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

  // Sequência: alternar entre semana e mês (estilo calendário de hábitos)
  const [showMonth, setShowMonth] = useState(false)
  const activeDates = useMemo(
    () => new Set((xpHistory ?? []).filter((x: any) => x?.date).map((x: any) => x.date.split('T')[0])),
    [xpHistory]
  )
  const monthCells = useMemo(() => buildMonthGrid(new Date()), [])
  const monthLabel = new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const aiInsight   = useMemo(() => {
    if (streak >= 7 && workoutDone) return t('home.insight_streak_max' as any, { streak })
    if (streak >= 3)                return t('home.insight_streak_good' as any, { streak })
    if (workoutDone && calPercent >= 70) return t('home.insight_workout_cal' as any)
    if (calPercent < 25)            return t('home.insight_cal_low' as any)
    if (calPercent > 95)            return t('home.insight_cal_high' as any)
    return                               t('home.insight_default' as any)
  }, [streak, calPercent, workoutDone, t])

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

  const hour = new Date().getHours()
  const greetingPeriod = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  const greetingSuffix = user.gender === 'fem' ? 'f' : 'm'
  const greeting = t(`home.greeting_${greetingPeriod}_${greetingSuffix}` as any)
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
        <Text style={s.heroGreeting}>{greeting}</Text>
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
                  <Text style={s.chipText}>{getMuscleLabel(chip)}</Text>
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
        {!showMonth ? (
          // ── Visão SEMANA ──
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
        ) : (
          // ── Visão MÊS (calendário de hábitos) ──
          <View style={s.monthWrap}>
            <Text style={s.monthLabel}>{monthLabel}</Text>
            <View style={s.monthHeaderRow}>
              {WEEK_DAY_KEYS.map(k => (
                <Text key={k} style={s.monthHeaderCell}>{t(k as any)}</Text>
              ))}
            </View>
            <View style={s.monthGrid}>
              {monthCells.map((cell, i) => (
                <View key={i} style={s.monthCell}>
                  {cell && (
                    <View style={[
                      s.monthDay,
                      cell.isToday ? s.monthDayToday
                        : activeDates.has(cell.dStr) ? s.monthDayActive
                        : cell.isFuture ? s.monthDayFuture : s.monthDayEmpty,
                    ]}>
                      <Text style={[
                        s.monthDayTxt,
                        cell.isToday && s.monthDayTxtToday,
                        activeDates.has(cell.dStr) && !cell.isToday && s.monthDayTxtActive,
                        cell.isFuture && s.monthDayTxtFuture,
                      ]}>
                        {cell.d}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity
          style={s.toggleBtn}
          activeOpacity={0.7}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowMonth(v => !v) }}
        >
          <Text style={s.toggleBtnTxt}>{showMonth ? t('home.see_week') : t('home.see_month')}</Text>
        </TouchableOpacity>
      </View>

      {/* ── RANK ──────────────────────────────────────────── */}
      <TouchableOpacity onPress={() => router.push('/(tabs)/ranks')} activeOpacity={0.85}>
        <LinearGradient colors={['#100D20', '#0A0A0A']} style={[s.card, s.rankCard]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={s.rankEmoji}>{rank.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.rankLabel}>{rank.label}</Text>
            <Text style={s.rankXp}>
              {(progress.totalXp ?? 0).toLocaleString()} XP
              {next ? ` · +${(next.minXp - (progress.totalXp ?? 0)).toLocaleString()} ${t('home.rank_xp_to' as any)} ${next.label}` : ''}
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
                <Text style={[s.moodLabel, { color: mc.text }]}>{getMoodLabel(m.id)}</Text>
                {isSelected && <Text style={s.moodCheck}>✓</Text>}
              </TouchableOpacity>
            )
          })}
        </View>
        {checkin && (
          <Text style={[s.checkinDoneText, { marginTop: 10 }]}>
            {(checkin.mood === 'tired' || checkin.mood === 'exhausted')
              ? t('home.mood_tired' as any)
              : t('home.mood_default' as any)}
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
  dayBox:          { flex: 1, aspectRatio: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayDone:         { backgroundColor: 'rgba(200,240,96,.18)' },
  dayToday:        { backgroundColor: Colors.accent },
  dayMissed:       { backgroundColor: Colors.bg3 },
  dayFuture:       { backgroundColor: Colors.bg3, opacity: 0.4 },
  dayLbl:          { fontSize: 10, fontWeight: '700', color: Colors.accent },
  dayLblToday:     { color: Colors.bg },
  dayLblMissed:    { color: Colors.text2 },
  dayLblFuture:    { color: Colors.text3 },
  dayDot:          { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  dayDotDone:      { backgroundColor: Colors.accent },
  dayDotToday:     { backgroundColor: Colors.bg },

  // Streak — visão mês (calendário de hábitos)
  monthWrap:        { marginTop: 2 },
  monthLabel:       { fontSize: 13, fontWeight: '700', color: Colors.text, textAlign: 'center', marginBottom: 10, textTransform: 'capitalize' },
  monthHeaderRow:   { flexDirection: 'row', marginBottom: 6 },
  monthHeaderCell:  { flex: 1, textAlign: 'center', fontSize: 9, fontWeight: '700', color: Colors.text3 },
  monthGrid:        { flexDirection: 'row', flexWrap: 'wrap' },
  monthCell:        { width: '14.2857%', aspectRatio: 1, padding: 3 },
  monthDay:         { flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  monthDayEmpty:    { backgroundColor: Colors.bg3 },
  monthDayActive:   { backgroundColor: 'rgba(200,240,96,.18)' },
  monthDayToday:    { backgroundColor: Colors.accent },
  monthDayFuture:   { backgroundColor: 'transparent' },
  monthDayTxt:      { fontSize: 11, fontWeight: '600', color: Colors.text2 },
  monthDayTxtToday: { color: Colors.bg, fontWeight: '800' },
  monthDayTxtActive:{ color: Colors.accent, fontWeight: '700' },
  monthDayTxtFuture:{ color: Colors.text3, opacity: 0.6 },
  toggleBtn:        { marginTop: 12, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, backgroundColor: Colors.bg3 },
  toggleBtnTxt:     { fontSize: 12, fontWeight: '600', color: Colors.accent },

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
