import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native'
import ExerciseVideoModal from '@components/ui/ExerciseVideoModal'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius, MOODS } from '@constants/index'
import { useWorkoutStore, useUserStore, useProgressStore, useCoachStore } from '@store/index'
import { swapPlanItem } from '@services/ai'
import { db } from '@services/supabase'
import { format, addDays, startOfWeek } from 'date-fns'
import SwapItemModal from '@components/ui/SwapItemModal'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { WorkoutSession } from '@/types/index'
import { useT } from '@/i18n/useT'

const DAYS_KEYS = ['days_short.mon','days_short.tue','days_short.wed','days_short.thu','days_short.fri','days_short.sat','days_short.sun']
const BLOCK_LABEL_KEYS: Record<string, string> = {
  warmup: 'workout.block_warmup', main: 'workout.block_main', cardio: 'workout.block_cardio', cooldown: 'workout.block_cooldown',
}
const BLOCK_STATUS_KEYS: Record<string, { labelKey: string; color: string; bg: string }> = {
  fixed:   { labelKey: 'workout.status_fixed',   color: Colors.teal,   bg: Colors.teal   + '18' },
  adapted: { labelKey: 'workout.status_adapted', color: Colors.accent,  bg: Colors.accent + '18' },
  ai_added:{ labelKey: 'workout.status_ai_added',color: Colors.orange,  bg: Colors.orange + '18' },
  locked:  { labelKey: 'workout.status_locked',  color: Colors.text3,   bg: Colors.bg3 },
}

export default function WorkoutScreen() {
  const insets = useSafeAreaInsets()
  const { t } = useT()
  const today = new Date().toISOString().split('T')[0]
  const [selectedDay, setSelectedDay] = useState(today)
  const [generating,   setGenerating]   = useState(false)
  const [swapModal,    setSwapModal]    = useState<WorkoutSession | null>(null)
  const [swapping,     setSwapping]     = useState(false)
  const [adaptingMood,  setAdaptingMood]  = useState(false)
  const [expandedTips,  setExpandedTips]  = useState<Set<string>>(new Set())
  const [videoModal,    setVideoModal]    = useState<{ name: string; searchName?: string } | null>(null)

  // ─── Rest timer (inline, por exercício) ────────────────────────────────────
  const REST_SECONDS = 60
  const [restingExId, setRestingExId] = useState<string | null>(null)
  const [restSecs,    setRestSecs]    = useState(0)
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRest = (exId: string) => {
    if (restRef.current) clearInterval(restRef.current)
    setRestingExId(exId)
    setRestSecs(REST_SECONDS)
    restRef.current = setInterval(() => {
      setRestSecs(prev => {
        if (prev <= 1) {
          clearInterval(restRef.current!)
          setRestingExId(null)
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const skipRest = () => {
    if (restRef.current) clearInterval(restRef.current)
    setRestingExId(null)
    setRestSecs(0)
  }

  useEffect(() => {
    return () => { if (restRef.current) clearInterval(restRef.current) }
  }, [])

  const toggleTip = (exId: string) =>
    setExpandedTips(prev => {
      const next = new Set(prev)
      next.has(exId) ? next.delete(exId) : next.add(exId)
      return next
    })

  const { user, isLoading }                                              = useUserStore()
  const { weekWorkouts, setWeekWorkouts, completeSet, completeWorkout, swapWorkoutDay } = useWorkoutStore()
  const { addXp, getTodayCheckin }                                       = useProgressStore()
  const { setPlanContext }                                               = useCoachStore()

  const checkin        = getTodayCheckin()
  const moodData       = checkin ? MOODS.find(m => m.id === checkin.mood) : null
  const moodIntensity  = moodData?.workoutIntensity ?? 1
  const isMoodReduced  = selectedDay === today && moodIntensity < 1

  // Adapta o treino de hoje automaticamente com base no humor
  const handleMoodAdapt = async () => {
    const workout = weekWorkouts.find(w => w.date === today)
    if (!workout || !checkin) return
    const reason = checkin.mood === 'exhausted'
      ? 'Estou exausto hoje. Quero um treino muito leve: apenas mobilidade, alongamento ou caminhada curta'
      : 'Estou cansado hoje. Quero um treino mais curto e de intensidade reduzida, sem cargas pesadas'
    setAdaptingMood(true)
    try {
      const newWorkout = await swapPlanItem('workout', workout as unknown as Record<string, unknown>, today, reason)
      swapWorkoutDay(today, newWorkout as unknown as WorkoutSession)
      Alert.alert(t('workout.mood_adapt_success'), t('workout.mood_adapt_success_msg'))
    } catch (err) {
      Alert.alert(t('common.error' as any), err instanceof Error ? err.message : t('common.retry' as any))
    } finally {
      setAdaptingMood(false)
    }
  }

  if (isLoading || !user) return null

  const weekStart  = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekDates  = Array.from({ length: 7 }, (_, i) =>
    format(addDays(weekStart, i), 'yyyy-MM-dd')
  )
  const todayWorkout = weekWorkouts.find(w => w.date === selectedDay)

  // Navega para feedback se já existe plano
  const handleGenerate = () => {
    if (!user?.isPremium) {
      Alert.alert(t('workout.premium_alert_title'), t('workout.premium_alert_msg'),
        [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.upgrade'), onPress: () => router.push('/(tabs)/subscription') }])
      return
    }
    router.push('/(tabs)/feedback?type=workout')
  }

  // Trocar dia de treino via IA
  const handleSwap = async (reason: string) => {
    if (!swapModal) return
    setSwapping(true)
    try {
      const newWorkout = await swapPlanItem(
        'workout',
        swapModal as unknown as Record<string, unknown>,
        swapModal.date,
        reason,
      )
      swapWorkoutDay(swapModal.date, newWorkout as unknown as WorkoutSession)
      setSwapModal(null)
      Alert.alert(t('workout.swap_success'), t('workout.swap_success_msg'))
    } catch (err) {
      Alert.alert(t('common.error' as any), err instanceof Error ? err.message : t('common.retry' as any))
    } finally {
      setSwapping(false)
    }
  }

  // Abre o Coach com contexto do treino
  const handleAskCoach = (workout: WorkoutSession) => {
    const dayIdx = (new Date(workout.date + 'T12:00:00').getDay() + 6) % 7
    setPlanContext({
      type:  'workout',
      label: `${t('tabs.workout')} - ${t(DAYS_KEYS[dayIdx] as any)}`,
      date:  workout.date,
      item:  workout,
    })
    router.push('/(tabs)/coach')
  }

  const handleSetDone = (workoutId: string, blockId: string, exerciseId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    completeSet(workoutId, blockId, exerciseId)
    startRest(exerciseId)
  }

  const handleFinishWorkout = (workoutId: string) => {
    Alert.alert(t('workout.finish_confirm_title'), t('workout.finish_confirm_msg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('workout.finish_confirm_btn'),
          onPress: () => {
            const workout = weekWorkouts.find(w => w.id === workoutId)
            completeWorkout(workoutId)
            addXp('WORKOUT_DONE')
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

            if (workout && user?.id) {
              db.logWorkout({
                id:          workout.id,
                user_id:     user.id,
                title:       workout.title,
                date:        workout.date,
                completed:   true,
                completed_at: new Date().toISOString(),
              }).then(
                () => {},
                (err) => console.warn('[NutriAI] Falha ao salvar treino no banco:', err)
              )
            }
          },
        },
      ])
  }

  return (
    <>
    <ExerciseVideoModal
      visible={videoModal !== null}
      exerciseName={videoModal?.name ?? ''}
      searchName={videoModal?.searchName}
      onClose={() => setVideoModal(null)}
    />
    <SwapItemModal
      visible={swapModal !== null}
      type="workout"
      title={swapModal ? `${t('workout.swap_title')} ${t(DAYS_KEYS[(new Date(swapModal.date + 'T12:00:00').getDay() + 6) % 7] as any)}` : ''}
      loading={swapping}
      onClose={() => setSwapModal(null)}
      onSwap={handleSwap}
    />
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>

      <View style={s.header}>
        <View>
          <Text style={s.title}>{t('workout.title')}</Text>
          <Text style={s.sub}>{t('workout.subtitle')}</Text>
        </View>
        <TouchableOpacity style={[s.genBtn, generating && { opacity: 0.6 }]} onPress={handleGenerate} disabled={generating}>
          {generating ? <ActivityIndicator size="small" color={Colors.bg} /> : <Text style={s.genBtnText}>{t('workout.generate_btn')}</Text>}
        </TouchableOpacity>
      </View>

      {/* Day selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dayScroll} contentContainerStyle={s.dayRow}>
        {weekDates.map((date, i) => {
          const w = weekWorkouts.find(w => w.date === date)
          const isSelected = date === selectedDay
          const isToday    = date === today
          return (
            <TouchableOpacity key={date} style={[s.dayPill, isSelected && s.dayPillSel, w?.completed && s.dayPillDone]} onPress={() => setSelectedDay(date)}>
              <Text style={[s.dayLabel, isSelected && s.dayLabelSel, w?.completed && s.dayLabelDone]}>{t(DAYS_KEYS[i] as any)}</Text>
              {isToday && !w?.completed && <View style={s.dot} />}
              {w?.completed && <Text style={s.doneCheck}>✓</Text>}
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* No workout */}
      {!todayWorkout ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyEmoji}>🏋️</Text>
          <Text style={s.emptyTitle}>{t('workout.no_workout_title')}</Text>
          <Text style={s.emptySub}>{user?.isPremium ? t('workout.no_workout_sub_premium') : t('workout.no_workout_sub_free')}</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={user?.isPremium ? handleGenerate : () => router.push('/(tabs)/subscription')}>
            <Text style={s.emptyBtnText}>{user?.isPremium ? t('workout.generate_workouts') : t('workout.see_premium')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Mood adaptation banner */}
          {isMoodReduced && checkin && !todayWorkout?.completed && (
            <View style={s.moodBanner}>
              <Text style={s.moodBannerTitle}>
                {checkin.moodEmoji} {checkin.mood === 'exhausted' ? t('workout.mood_banner_exhausted') : t('workout.mood_banner_tired')}
              </Text>
              <Text style={s.moodBannerSub}>
                {t('workout.mood_banner_sub', { percent: Math.round(moodIntensity * 100) })}
              </Text>
              <TouchableOpacity
                style={[s.moodAdaptBtn, adaptingMood && { opacity: 0.6 }]}
                onPress={handleMoodAdapt}
                disabled={adaptingMood}
              >
                {adaptingMood
                  ? <ActivityIndicator size="small" color={Colors.bg} />
                  : <Text style={s.moodAdaptBtnText}>{t('workout.mood_adapt_btn')}</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Overview */}
          <View style={s.overviewCard}>
            <Text style={s.overviewTitle}>{todayWorkout.title}</Text>
            <View style={s.overviewStats}>
              {[
                { label: t('workout.exercises'), val: todayWorkout.blocks.reduce((a, b) => a + (b.exercises?.length ?? 0), 0) },
                { label: t('workout.minutes'), val: `~${todayWorkout.estimatedDuration}` },
                { label: t('workout.calories_est'), val: todayWorkout.estimatedCalories },
              ].map(stat => (
                <View key={stat.label} style={s.overviewStat}>
                  <Text style={s.overviewVal}>{stat.val}</Text>
                  <Text style={s.overviewLbl}>{stat.label}</Text>
                </View>
              ))}
            </View>
            {!todayWorkout.completed && (
              <>
                <TouchableOpacity style={s.finishBtn} onPress={() => handleFinishWorkout(todayWorkout.id)}>
                  <Text style={s.finishBtnText}>{t('workout.finish_btn')}</Text>
                </TouchableOpacity>
                <View style={s.aiRow}>
                  <TouchableOpacity style={s.swapBtn} onPress={() => setSwapModal(todayWorkout)}>
                    <Text style={s.swapBtnText}>{t('workout.swap_btn')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.coachBtn} onPress={() => handleAskCoach(todayWorkout)}>
                    <Text style={s.coachBtnText}>{t('workout.coach_btn')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            {todayWorkout.completed && (
              <View style={s.completedBanner}>
                <Text style={s.completedText}>{t('workout.completed_banner')}</Text>
              </View>
            )}
          </View>

          {/* Blocks */}
          {todayWorkout.blocks.map(block => {
            const statusStyle = BLOCK_STATUS_KEYS[block.status] ?? BLOCK_STATUS_KEYS.fixed
            return (
              <View key={block.id} style={[s.blockCard, block.status === 'adapted' && s.blockAdapted]}>
                <View style={s.blockHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.blockTitle}>{block.title}</Text>
                    <Text style={s.blockSub}>{t(BLOCK_LABEL_KEYS[block.type] as any)} · {block.durationMin} {t('common.min')}</Text>
                    {block.originalTitle && (
                      <Text style={s.blockOriginal}>{t('workout.block_original')} {block.originalTitle}</Text>
                    )}
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[s.statusText, { color: statusStyle.color }]}>{t(statusStyle.labelKey as any)}</Text>
                  </View>
                </View>

                {block.exercises && block.exercises.map(ex => {
                  const allDone      = ex.completedSets >= ex.sets
                  const tipVisible   = expandedTips.has(ex.id)
                  const hasActions   = !!ex.searchName || !!ex.tip
                  const isResting    = restingExId === ex.id
                  const restProgress = isResting ? restSecs / REST_SECONDS : 0
                  const restLabel    = `${Math.floor(restSecs / 60)}:${String(restSecs % 60).padStart(2, '0')}`

                  return (
                    <View key={ex.id} style={s.exBlock}>
                      {/* Linha principal: ícone + info + séries */}
                      <View style={s.exRow}>
                        <View style={[s.exIcon, allDone && s.exIconDone]}>
                          <Text style={{ fontSize: 15 }}>🏋️</Text>
                        </View>
                        <View style={s.exInfo}>
                          <Text style={[s.exName, allDone && { color: Colors.teal }]} numberOfLines={2}>
                            {ex.name}
                          </Text>
                          <Text style={s.exDetail}>
                            {(() => {
                              const isTimeBased = /\d+\s*(s|seg|min)/i.test(String(ex.reps))
                              const repsText = isTimeBased ? String(ex.reps) : `${ex.reps} reps`
                              return `${ex.sets} ${t('common.series')} · ${repsText}${ex.weight ? ` · ${ex.weight} ${t('common.kg')}` : ''} · ${t('common.rest')} ${REST_SECONDS}s`
                            })()}
                          </Text>
                        </View>
                        <View style={s.setRow}>
                          {Array.from({ length: ex.sets }, (_, i) => (
                            <TouchableOpacity
                              key={i}
                              style={[s.setBtn, i < ex.completedSets && s.setBtnDone]}
                              onPress={() => !todayWorkout.completed && handleSetDone(todayWorkout.id, block.id, ex.id)}
                              disabled={todayWorkout.completed}
                            >
                              <Text style={[s.setBtnText, i < ex.completedSets && s.setBtnTextDone]}>
                                {i + 1}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      {/* ── Timer de descanso inline ─────────── */}
                      {isResting && (
                        <View style={s.restRow}>
                          <Text style={s.restCountdown}>⏱ {restLabel}</Text>
                          <View style={s.restTrack}>
                            <View style={[s.restFill, { width: `${restProgress * 100}%` as any }]} />
                          </View>
                          <TouchableOpacity onPress={skipRest} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={s.restSkip}>{t('workout.skip_rest')}</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Chips de ação */}
                      {hasActions && (
                        <View style={s.exActions}>
                          {ex.searchName && (
                            <TouchableOpacity
                              style={s.chipDemo}
                              onPress={() => setVideoModal({ name: ex.name, searchName: ex.searchName })}
                            >
                              <Text style={s.chipDemoIcon}>▶</Text>
                              <Text style={s.chipDemoText}>{t('workout.demo_btn')}</Text>
                            </TouchableOpacity>
                          )}
                          {ex.tip && (
                            <TouchableOpacity
                              style={[s.chipTip, tipVisible && s.chipTipActive]}
                              onPress={() => toggleTip(ex.id)}
                            >
                              <Text style={s.chipTipIcon}>{tipVisible ? '✕' : '💡'}</Text>
                              <Text style={[s.chipTipText, tipVisible && { color: Colors.accent }]}>
                                {tipVisible ? t('common.seeLess') : t('workout.tip_label')}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}

                      {/* Caixa da dica */}
                      {tipVisible && ex.tip && (
                        <View style={s.tipBox}>
                          <Text style={s.tipText}>{ex.tip}</Text>
                        </View>
                      )}
                    </View>
                  )
                })}
              </View>
            )
          })}
        </>
      )}

    </ScrollView>
    </>
  )
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: Colors.bg },
  content:         { padding: Spacing[5], paddingBottom: 100 },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title:           { fontSize: 22, fontWeight: '800', color: Colors.text },
  sub:             { fontSize: 13, color: Colors.text2, marginTop: 2 },
  genBtn:          { backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  genBtnText:      { fontSize: 13, fontWeight: '700', color: Colors.bg },
  dayScroll:       { marginBottom: 14 },
  dayRow:          { gap: 8, paddingRight: 4 },
  dayPill:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', gap: 3 },
  dayPillSel:      { backgroundColor: Colors.text, borderColor: Colors.text },
  dayPillDone:     { backgroundColor: Colors.teal + '18', borderColor: Colors.teal + '44' },
  dayLabel:        { fontSize: 12, fontWeight: '600', color: Colors.text2 },
  dayLabelSel:     { color: Colors.bg },
  dayLabelDone:    { color: Colors.teal },
  dot:             { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.accent },
  doneCheck:       { fontSize: 10, color: Colors.teal },
  emptyCard:       { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  emptyEmoji:      { fontSize: 48, marginBottom: 12 },
  emptyTitle:      { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  emptySub:        { fontSize: 13, color: Colors.text2, textAlign: 'center', marginBottom: 20 },
  emptyBtn:        { backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 11 },
  emptyBtnText:    { fontSize: 14, fontWeight: '700', color: Colors.bg },
  overviewCard:    { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  overviewTitle:   { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 12 },
  overviewStats:   { flexDirection: 'row', gap: 8, marginBottom: 12 },
  overviewStat:    { flex: 1, backgroundColor: Colors.bg3, borderRadius: 10, padding: 10, alignItems: 'center' },
  overviewVal:     { fontSize: 18, fontWeight: '700', color: Colors.accent },
  overviewLbl:     { fontSize: 10, color: Colors.text2, marginTop: 2 },
  finishBtn:       { backgroundColor: Colors.accent, borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 8 },
  finishBtnText:   { fontSize: 14, fontWeight: '700', color: Colors.bg },
  aiRow:           { flexDirection: 'row', gap: 8 },
  swapBtn:         { flex: 1, borderWidth: 1, borderColor: Colors.border2, borderRadius: 10, padding: 10, alignItems: 'center' },
  swapBtnText:     { fontSize: 12, fontWeight: '600', color: Colors.text2 },
  coachBtn:        { flex: 2, borderWidth: 1, borderColor: Colors.accent + '60', borderRadius: 10, padding: 10, alignItems: 'center', backgroundColor: Colors.accent + '10' },
  coachBtnText:    { fontSize: 12, fontWeight: '600', color: Colors.accent },
  completedBanner:  { backgroundColor: Colors.teal + '18', borderRadius: 10, padding: 10, alignItems: 'center' },
  completedText:    { fontSize: 13, fontWeight: '600', color: Colors.teal },
  moodBanner:       { backgroundColor: Colors.orange + '14', borderRadius: Radius.lg, padding: 13, borderWidth: 1, borderColor: Colors.orange + '30', marginBottom: 10, gap: 6 },
  moodBannerTitle:  { fontSize: 13, fontWeight: '700', color: Colors.orange },
  moodBannerSub:    { fontSize: 12, color: Colors.orange, opacity: 0.85, lineHeight: 17 },
  moodAdaptBtn:     { backgroundColor: Colors.orange, borderRadius: 9, padding: 10, alignItems: 'center', marginTop: 4 },
  moodAdaptBtnText: { fontSize: 13, fontWeight: '700', color: Colors.bg },
  blockCard:        { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: Colors.border2 },
  blockAdapted:     { borderLeftColor: Colors.accent, backgroundColor: '#111800' },
  blockHeader:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  blockTitle:       { fontSize: 14, fontWeight: '600', color: Colors.text },
  blockSub:         { fontSize: 11, color: Colors.text2, marginTop: 2 },
  blockOriginal:    { fontSize: 10, color: Colors.text3, marginTop: 2 },
  statusBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText:       { fontSize: 10, fontWeight: '700' },

  // Exercício
  exBlock:          { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, paddingBottom: 4, gap: 8 },
  exRow:            { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  exIcon:           { width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.bg3, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  exIconDone:       { backgroundColor: Colors.teal + '20' },
  exInfo:           { flex: 1 },
  exName:           { fontSize: 13, fontWeight: '600', color: Colors.text, lineHeight: 18 },
  exDetail:         { fontSize: 11, color: Colors.text2, marginTop: 2 },

  // Chips de ação
  exActions:        { flexDirection: 'row', gap: 6, marginLeft: 44, flexWrap: 'wrap' },
  chipDemo:         { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.accent, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5 },
  chipDemoIcon:     { fontSize: 9, color: Colors.bg, fontWeight: '900' },
  chipDemoText:     { fontSize: 11, fontWeight: '700', color: Colors.bg },
  chipTip:          { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.bg3, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5, borderWidth: 1, borderColor: Colors.border2 },
  chipTipActive:    { backgroundColor: Colors.accent + '15', borderColor: Colors.accent + '50' },
  chipTipIcon:      { fontSize: 11 },
  chipTipText:      { fontSize: 11, fontWeight: '600', color: Colors.text2 },

  // Dica
  tipBox:           { marginLeft: 44, backgroundColor: Colors.accent + '10', borderRadius: 9, padding: 10, borderLeftWidth: 2, borderLeftColor: Colors.accent },
  tipText:          { fontSize: 12, color: Colors.text2, lineHeight: 18 },

  // Rest timer inline
  restRow:          { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 44, marginTop: 2, marginBottom: 2 },
  restCountdown:    { fontSize: 12, fontWeight: '700', color: Colors.accent, width: 44 },
  restTrack:        { flex: 1, height: 3, backgroundColor: Colors.border2, borderRadius: 2, overflow: 'hidden' },
  restFill:         { height: '100%', backgroundColor: Colors.accent, borderRadius: 2 },
  restSkip:         { fontSize: 11, fontWeight: '600', color: Colors.text3 },

  // Séries
  setRow:           { flexDirection: 'row', gap: 4, flexShrink: 0 },
  setBtn:           { width: 26, height: 26, borderRadius: 7, borderWidth: 1, borderColor: Colors.border2, alignItems: 'center', justifyContent: 'center' },
  setBtnDone:       { backgroundColor: Colors.teal, borderColor: Colors.teal },
  setBtnText:       { fontSize: 11, color: Colors.text2, fontWeight: '600' },
  setBtnTextDone:   { color: Colors.bg },
})
