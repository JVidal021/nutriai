import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@constants/index'
import { useNutritionStore, useUserStore, useProgressStore, useCoachStore } from '@store/index'
import { swapPlanItem } from '@services/ai'
import { format, addDays, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import SwapItemModal from '@components/ui/SwapItemModal'
import type { PlannedMeal } from '@/types/index'
import { useT } from '@/i18n/useT'

const DAYS_KEYS = ['days_short.mon','days_short.tue','days_short.wed','days_short.thu','days_short.fri','days_short.sat','days_short.sun']
const MEAL_EMOJI: Record<string, string> = {
  breakfast: '☕', lunch: '🍗', dinner: '🐟', snack: '🍎',
}

export default function DietScreen() {
  const insets = useSafeAreaInsets()
  const { t } = useT()
  const today = new Date().toISOString().split('T')[0]
  const [selectedDay, setSelectedDay] = useState(today)
  const [generating,   setGenerating]   = useState(false)
  const [swapModal,    setSwapModal]    = useState<{ meal: PlannedMeal; date: string } | null>(null)
  const [swapping,     setSwapping]     = useState(false)
  const [adaptingMood, setAdaptingMood] = useState(false)

  const { user, isLoading }                                    = useUserStore()
  const { weekPlan, setWeekPlan, markMealCompleted, swapMeal } = useNutritionStore()
  const { addXp, getTodayCheckin }                             = useProgressStore()
  const { setPlanContext }                                     = useCoachStore()

  if (isLoading || !user) return null

  const checkin      = getTodayCheckin()
  const moodCalAdj   = checkin?.adaptations?.caloriesAdjusted ?? 0
  const isMoodActive = selectedDay === today && moodCalAdj !== 0

  // Build week date array starting Monday
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekDates = Array.from({ length: 7 }, (_, i) =>
    format(addDays(weekStart, i), 'yyyy-MM-dd')
  )

  const selectedPlan = weekPlan.find(d => d.date === selectedDay)

  // Navega para feedback se já existe plano, gera direto se não existe
  const handleGenerate = () => {
    if (!user?.isPremium) {
      Alert.alert(
        t('diet.premium_alert_title'),
        t('diet.premium_alert_msg'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.upgrade'), onPress: () => router.push('/(tabs)/subscription') },
        ]
      )
      return
    }
    router.push('/(tabs)/feedback?type=diet')
  }

  // Trocar uma refeição específica via IA
  const handleSwap = async (reason: string) => {
    if (!swapModal) return
    setSwapping(true)
    try {
      const newMeal = await swapPlanItem(
        'meal',
        swapModal.meal as unknown as Record<string, unknown>,
        swapModal.date,
        reason,
      )
      swapMeal(swapModal.date, swapModal.meal.type, newMeal as unknown as PlannedMeal)
      setSwapModal(null)
      Alert.alert(t('diet.swap_success'), t('diet.swap_success_msg'))
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('common.retry'))
    } finally {
      setSwapping(false)
    }
  }

  // Abre o Coach com contexto da refeição
  const handleAskCoach = (meal: PlannedMeal, date: string) => {
    const dayName = format(new Date(date + 'T12:00:00'), 'EEEE', { locale: ptBR })
    const mealLabel: Record<string, string> = { breakfast: t('meals.breakfast'), lunch: t('meals.lunch'), dinner: t('meals.dinner'), snack: t('meals.snack') }
    setPlanContext({
      type:     'diet',
      label:    `${mealLabel[meal.type] ?? meal.type} - ${dayName}`,
      date,
      mealType: meal.type,
      item:     meal,
    })
    router.push('/(tabs)/coach')
  }

  const handleMarkMeal = (mealType: string, completed: boolean) => {
    if (completed) return
    markMealCompleted(selectedDay, mealType)
    addXp('MEAL_LOGGED')
  }

  // Adapta todas as refeições não concluídas de hoje ao humor do check-in
  const handleMoodAdaptDiet = async () => {
    const todayPlan = weekPlan.find(d => d.date === today)
    if (!todayPlan || !checkin) return
    const pendingMeals = todayPlan.meals.filter(m => !m.completed)
    if (pendingMeals.length === 0) return

    const reason = checkin.mood === 'exhausted'
      ? 'Estou exausto hoje. Quero refeições muito leves, de fácil preparo e poucas calorias'
      : 'Estou cansado hoje. Quero refeições mais simples e um pouco mais leves que o normal'

    setAdaptingMood(true)
    try {
      await Promise.all(
        pendingMeals.map(async (meal) => {
          const newMeal = await swapPlanItem('meal', meal as unknown as Record<string, unknown>, today, reason)
          swapMeal(today, meal.type, newMeal as unknown as PlannedMeal)
        })
      )
      Alert.alert(t('diet.mood_adapt_success'), t('diet.mood_adapt_success_msg'))
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('common.retry'))
    } finally {
      setAdaptingMood(false)
    }
  }

  return (
    <>
    <SwapItemModal
      visible={swapModal !== null}
      type="meal"
      title={swapModal ? `${t('diet.swap_title')}: ${t(`meals.${swapModal.meal.type}` as any)}` : ''}
      loading={swapping}
      onClose={() => setSwapModal(null)}
      onSwap={handleSwap}
    />
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>{t('diet.title')}</Text>
          <Text style={s.sub}>{t('diet.subtitle')}</Text>
        </View>
        <TouchableOpacity
          style={[s.genBtn, generating && { opacity: 0.6 }]}
          onPress={handleGenerate}
          disabled={generating}
        >
          {generating
            ? <ActivityIndicator size="small" color={Colors.bg} />
            : <Text style={s.genBtnText}>{t('diet.generate_btn')}</Text>}
        </TouchableOpacity>
      </View>

      {/* Day selector */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={s.dayScroll} contentContainerStyle={s.dayRow}
      >
        {weekDates.map((date, i) => {
          const isToday    = date === today
          const isSelected = date === selectedDay
          const hasPlan    = weekPlan.some(d => d.date === date)
          return (
            <TouchableOpacity
              key={date}
              style={[s.dayPill, isSelected && s.dayPillSel]}
              onPress={() => setSelectedDay(date)}
            >
              <Text style={[s.dayLabel, isSelected && s.dayLabelSel]}>{t(DAYS_KEYS[i] as any)}</Text>
              {isToday && <View style={s.todayDot} />}
              {hasPlan && !isToday && <View style={[s.todayDot, { backgroundColor: Colors.teal }]} />}
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* No plan state */}
      {!selectedPlan ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyEmoji}>🥗</Text>
          <Text style={s.emptyTitle}>{t('diet.no_plan_title')}</Text>
          <Text style={s.emptySub}>
            {user?.isPremium
              ? t('diet.no_plan_sub_premium')
              : t('diet.no_plan_sub_free')}
          </Text>
          <TouchableOpacity
            style={s.emptyBtn}
            onPress={user?.isPremium ? handleGenerate : () => router.push('/(tabs)/subscription')}
          >
            <Text style={s.emptyBtnText}>
              {user?.isPremium ? t('diet.generate_plan_now') : t('diet.see_premium')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Daily targets */}
          <View style={s.card}>
            <View style={s.cardRow}>
              <Text style={s.cardTitle}>{t('diet.day_target')}</Text>
              <Text style={s.calTarget}>
                {(selectedPlan.targetMacros.calories + (isMoodActive ? moodCalAdj : 0)).toLocaleString()} kcal
              </Text>
            </View>
            <View style={s.macroRow}>
              {[
                { label: t('diet.protein'), val: selectedPlan.targetMacros.protein, color: Colors.purple, unit: 'g' },
                { label: t('diet.carbs_full'), val: selectedPlan.targetMacros.carbs, color: Colors.teal, unit: 'g' },
                { label: t('diet.fat'), val: selectedPlan.targetMacros.fat, color: Colors.orange, unit: 'g' },
                { label: t('diet.fiber'), val: selectedPlan.targetMacros.fiber ?? 28, color: Colors.text2, unit: 'g' },
              ].map(m => (
                <View key={m.label} style={s.macroPill}>
                  <Text style={[s.macroVal, { color: m.color }]}>{m.val}{m.unit}</Text>
                  <Text style={s.macroLbl}>{m.label}</Text>
                </View>
              ))}
            </View>
            {/* Banner de ajuste pelo check-in emocional (hoje) */}
            {isMoodActive && (
              <View style={s.moodBanner}>
                <Text style={s.moodBannerTitle}>
                  {checkin!.mood === 'exhausted'
                    ? t('diet.mood_you_are_exhausted', { emoji: checkin!.moodEmoji })
                    : t('diet.mood_you_are_tired',     { emoji: checkin!.moodEmoji })}
                </Text>
                <Text style={s.moodBannerText}>
                  {t('diet.mood_cal_reduced', { adj: Math.abs(moodCalAdj) })}
                </Text>
                <TouchableOpacity
                  style={[s.moodAdaptBtn, adaptingMood && { opacity: 0.6 }]}
                  onPress={handleMoodAdaptDiet}
                  disabled={adaptingMood}
                >
                  {adaptingMood
                    ? <ActivityIndicator size="small" color={Colors.bg} />
                    : <Text style={s.moodAdaptBtnText}>{t('diet.mood_adapt_btn')}</Text>
                  }
                </TouchableOpacity>
              </View>
            )}
            {/* Banner de ajuste pela IA (semanal) */}
            {selectedPlan.adjustedCalories && !isMoodActive && (
              <View style={s.adjustBanner}>
                <Text style={s.adjustText}>
                  {t('diet.ai_adj_label')} {selectedPlan.adjustedCalories} kcal
                  {selectedPlan.adjustmentReason ? ` · ${selectedPlan.adjustmentReason}` : ''}
                </Text>
              </View>
            )}
          </View>

          {/* Meals */}
          {selectedPlan.meals.map(meal => (
            <View key={meal.type} style={s.card}>
              <View style={s.cardRow}>
                <Text style={s.cardTitle}>
                  {MEAL_EMOJI[meal.type]} {t(`meals.${meal.type}` as any)}
                </Text>
                <Text style={s.mealCal}>~{meal.totalMacros.calories} kcal</Text>
              </View>

              {meal.foods.map((food, i) => (
                <View key={i} style={[s.foodRow, i === meal.foods.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.foodName}>{food.name}</Text>
                    <Text style={s.foodDetail}>
                      {food.quantity}{food.unit ?? 'g'} · {food.macros.calories} kcal
                    </Text>
                  </View>
                  <Text style={s.foodProt}>{food.macros.protein}g {t('diet.prot_short')}</Text>
                </View>
              ))}

              <View style={s.mealActions}>
                {meal.completed ? (
                  <View style={s.completedBadge}>
                    <Text style={s.completedText}>{t('diet.registered')}</Text>
                  </View>
                ) : (
                  <>
                    <View style={s.mealBtns}>
                      <TouchableOpacity style={s.photoBtn} onPress={() => router.push('/(tabs)/scan')}>
                        <Text style={s.photoBtnText}>{t('diet.photo_btn')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.doneBtn} onPress={() => handleMarkMeal(meal.type, meal.completed)}>
                        <Text style={s.doneBtnText}>{t('diet.ate_btn')}</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={s.aiRow}>
                      <TouchableOpacity style={s.swapBtn} onPress={() => setSwapModal({ meal, date: selectedDay })}>
                        <Text style={s.swapBtnText}>{t('diet.swap_btn_short')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.coachBtn} onPress={() => handleAskCoach(meal, selectedDay)}>
                        <Text style={s.coachBtnText}>{t('diet.coach_btn')}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          ))}
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
  dayLabel:        { fontSize: 12, fontWeight: '600', color: Colors.text2 },
  dayLabelSel:     { color: Colors.bg },
  todayDot:        { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.accent },
  emptyCard:       { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  emptyEmoji:      { fontSize: 48, marginBottom: 12 },
  emptyTitle:      { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  emptySub:        { fontSize: 13, color: Colors.text2, textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  emptyBtn:        { backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 11 },
  emptyBtnText:    { fontSize: 14, fontWeight: '700', color: Colors.bg },
  card:            { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  cardRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle:       { fontSize: 14, fontWeight: '600', color: Colors.text },
  calTarget:       { fontSize: 18, fontWeight: '800', color: Colors.accent },
  macroRow:        { flexDirection: 'row', gap: 8 },
  macroPill:       { flex: 1, backgroundColor: Colors.bg3, borderRadius: 9, padding: 8, alignItems: 'center' },
  macroVal:        { fontSize: 14, fontWeight: '700' },
  macroLbl:        { fontSize: 9, color: Colors.text2, marginTop: 1 },
  adjustBanner:    { marginTop: 10, backgroundColor: Colors.purple + '18', borderRadius: 8, padding: 8 },
  adjustText:      { fontSize: 11, color: Colors.purple },
  moodBanner:      { marginTop: 10, backgroundColor: Colors.orange + '18', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.orange + '30', gap: 5 },
  moodBannerTitle: { fontSize: 12, fontWeight: '700', color: Colors.orange },
  moodBannerText:  { fontSize: 11, color: Colors.orange, lineHeight: 16 },
  moodAdaptBtn:    { backgroundColor: Colors.orange, borderRadius: 8, padding: 9, alignItems: 'center', marginTop: 2 },
  moodAdaptBtnText:{ fontSize: 12, fontWeight: '700', color: Colors.bg },
  mealCal:         { fontSize: 13, color: Colors.text2 },
  foodRow:         { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border, flexDirection: 'row', alignItems: 'center', gap: 8 },
  foodName:        { fontSize: 13, fontWeight: '500', color: Colors.text },
  foodDetail:      { fontSize: 11, color: Colors.text2, marginTop: 1 },
  foodProt:        { fontSize: 11, color: Colors.purple },
  mealActions:     { marginTop: 10 },
  completedBadge:  { backgroundColor: Colors.teal + '18', borderRadius: 8, padding: 8, alignItems: 'center' },
  completedText:   { fontSize: 12, fontWeight: '600', color: Colors.teal },
  mealBtns:        { flexDirection: 'row', gap: 8, marginBottom: 8 },
  photoBtn:        { flex: 2, borderWidth: 1, borderColor: Colors.border2, borderRadius: 9, padding: 10, alignItems: 'center' },
  photoBtnText:    { fontSize: 12, fontWeight: '500', color: Colors.text2 },
  doneBtn:         { flex: 1, backgroundColor: Colors.accent, borderRadius: 9, padding: 10, alignItems: 'center' },
  doneBtnText:     { fontSize: 12, fontWeight: '700', color: Colors.bg },
  aiRow:           { flexDirection: 'row', gap: 8 },
  swapBtn:         { flex: 1, borderWidth: 1, borderColor: Colors.border2, borderRadius: 9, padding: 9, alignItems: 'center' },
  swapBtnText:     { fontSize: 12, fontWeight: '600', color: Colors.text2 },
  coachBtn:        { flex: 2, borderWidth: 1, borderColor: Colors.accent + '60', borderRadius: 9, padding: 9, alignItems: 'center', backgroundColor: Colors.accent + '10' },
  coachBtnText:    { fontSize: 12, fontWeight: '600', color: Colors.accent },
})
