import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Spacing, Radius } from '@constants/index'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNutritionStore, useWorkoutStore, useUserStore } from '@store/index'
import { generateDietPlan, generateWorkoutPlan } from '@services/ai'
import { useT, resolveErrorMessage } from '@/i18n/useT'

export default function WeeklyFeedbackScreen() {
  const insets = useSafeAreaInsets()
  const { t } = useT()
  const { type } = useLocalSearchParams<{ type: 'diet' | 'workout' }>()
  const { user }          = useUserStore()
  const { setWeekPlan, weeklyFeedback, setWeeklyFeedback } = useNutritionStore()
  const { setWeekWorkouts }                                = useWorkoutStore()

  const [whatWorked,    setWhatWorked]    = useState(weeklyFeedback?.whatWorked    ?? '')
  const [whatDidnt,     setWhatDidnt]     = useState(weeklyFeedback?.whatDidnt     ?? '')
  const [wantsToChange, setWantsToChange] = useState(weeklyFeedback?.wantsToChange ?? '')
  const [generating,    setGenerating]    = useState(false)

  const isDiet = type !== 'workout'

  const buildFeedbackText = (withFeedback: boolean): string => {
    if (!withFeedback) return ''
    const parts: string[] = []
    if (whatWorked.trim())    parts.push(`${t('weekly_feedback.feedback_worked' as any)} ${whatWorked.trim()}`)
    if (whatDidnt.trim())     parts.push(`${t('weekly_feedback.feedback_didnt' as any)} ${whatDidnt.trim()}`)
    if (wantsToChange.trim()) parts.push(`${t('weekly_feedback.feedback_change' as any)} ${wantsToChange.trim()}`)
    return parts.join('. ')
  }

  const handleGenerate = async (withFeedback: boolean) => {
    setGenerating(true)
    try {
      const feedbackText = buildFeedbackText(withFeedback)

      if (withFeedback && feedbackText) {
        setWeeklyFeedback({
          whatWorked,
          whatDidnt,
          wantsToChange,
          submittedAt: new Date().toISOString(),
        })
      }

      if (isDiet) {
        const plan = await generateDietPlan(0, feedbackText)
        setWeekPlan(plan)
      } else {
        const plan = await generateWorkoutPlan(0, feedbackText)
        setWeekWorkouts(plan)
      }

      router.replace(isDiet ? '/(tabs)/diet' : '/(tabs)/workout')
    } catch (err) {
      Alert.alert(t('common.error' as any), resolveErrorMessage(err))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backText}>← {t('common.back' as any)}</Text>
      </TouchableOpacity>

      <Text style={s.title}>
        {isDiet ? t('weekly_feedback.diet_title' as any) : t('weekly_feedback.workout_title' as any)}
      </Text>
      <Text style={s.sub}>{t('weekly_feedback.sub' as any)}</Text>

      <View style={s.card}>
        <View style={s.question}>
          <Text style={s.qIcon}>✅</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.qLabel}>{t('weekly_feedback.q1_label' as any)}</Text>
            <TextInput
              style={s.input}
              value={whatWorked}
              onChangeText={setWhatWorked}
              placeholder={isDiet
                ? t('weekly_feedback.q1_diet_placeholder' as any)
                : t('weekly_feedback.q1_workout_placeholder' as any)}
              placeholderTextColor={Colors.text3}
              multiline
              maxLength={300}
            />
          </View>
        </View>

        <View style={s.question}>
          <Text style={s.qIcon}>❌</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.qLabel}>{t('weekly_feedback.q2_label' as any)}</Text>
            <TextInput
              style={s.input}
              value={whatDidnt}
              onChangeText={setWhatDidnt}
              placeholder={isDiet
                ? t('weekly_feedback.q2_diet_placeholder' as any)
                : t('weekly_feedback.q2_workout_placeholder' as any)}
              placeholderTextColor={Colors.text3}
              multiline
              maxLength={300}
            />
          </View>
        </View>

        <View style={[s.question, { borderBottomWidth: 0 }]}>
          <Text style={s.qIcon}>💡</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.qLabel}>{t('weekly_feedback.q3_label' as any)}</Text>
            <TextInput
              style={s.input}
              value={wantsToChange}
              onChangeText={setWantsToChange}
              placeholder={isDiet
                ? t('weekly_feedback.q3_diet_placeholder' as any)
                : t('weekly_feedback.q3_workout_placeholder' as any)}
              placeholderTextColor={Colors.text3}
              multiline
              maxLength={300}
            />
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[s.generateBtn, generating && { opacity: 0.7 }]}
        onPress={() => handleGenerate(true)}
        disabled={generating}
      >
        {generating
          ? <ActivityIndicator color={Colors.bg} />
          : (
            <View style={{ alignItems: 'center' }}>
              <Text style={s.generateText}>{t('weekly_feedback.generate_btn' as any)}</Text>
              <Text style={s.generateSub}>{t('weekly_feedback.generate_sub' as any)}</Text>
            </View>
          )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.skipBtn, generating && { opacity: 0.5 }]}
        onPress={() => handleGenerate(false)}
        disabled={generating}
      >
        <Text style={s.skipText}>{t('weekly_feedback.skip_btn' as any)}</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: Colors.bg },
  content:       { padding: Spacing[5], paddingBottom: 60 },
  backBtn:       { marginBottom: 20 },
  backText:      { fontSize: 14, color: Colors.text2, fontWeight: '500' },
  title:         { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  sub:           { fontSize: 13, color: Colors.text2, lineHeight: 18, marginBottom: 20 },
  card:          { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 4, borderWidth: 1, borderColor: Colors.border, marginBottom: 20 },
  question:      { padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  qIcon:         { fontSize: 20, marginTop: 2 },
  qLabel:        { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  input:         { backgroundColor: Colors.bg3, borderRadius: Radius.md, padding: 12, fontSize: 13, color: Colors.text, borderWidth: 1, borderColor: Colors.border2, minHeight: 72, textAlignVertical: 'top', lineHeight: 18 },
  generateBtn:   { backgroundColor: Colors.accent, borderRadius: Radius.md, padding: 16, alignItems: 'center', marginBottom: 10 },
  generateText:  { fontSize: 16, fontWeight: '800', color: Colors.bg },
  generateSub:   { fontSize: 11, color: Colors.bg, opacity: 0.7, marginTop: 3 },
  skipBtn:       { borderWidth: 1, borderColor: Colors.border2, borderRadius: Radius.md, padding: 14, alignItems: 'center' },
  skipText:      { fontSize: 14, fontWeight: '600', color: Colors.text2 },
})
