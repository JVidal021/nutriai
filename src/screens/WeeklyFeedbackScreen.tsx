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

export default function WeeklyFeedbackScreen() {
  const insets = useSafeAreaInsets()
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
    if (whatWorked.trim())    parts.push(`O que funcionou: ${whatWorked.trim()}`)
    if (whatDidnt.trim())     parts.push(`O que não funcionou: ${whatDidnt.trim()}`)
    if (wantsToChange.trim()) parts.push(`Mudanças desejadas: ${wantsToChange.trim()}`)
    return parts.join('. ')
  }

  const handleGenerate = async (withFeedback: boolean) => {
    setGenerating(true)
    try {
      const feedbackText = buildFeedbackText(withFeedback)

      // Salvar feedback para futura referência
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

      // Volta explicitamente para a aba correta em vez de router.back()
      // (evita ir para Home em certas pilhas de navegação)
      router.replace(isDiet ? '/(tabs)/diet' : '/(tabs)/workout')
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Tente novamente.')
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
      {/* Cabeçalho */}
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backText}>← Voltar</Text>
      </TouchableOpacity>

      <Text style={s.title}>
        {isDiet ? '🥗 Novo Plano Alimentar' : '💪 Novo Plano de Treino'}
      </Text>
      <Text style={s.sub}>
        Como foi a semana? Seu feedback ajuda a IA a gerar um plano cada vez mais personalizado.
        Os campos são opcionais — você pode pular se preferir.
      </Text>

      {/* Card de feedback */}
      <View style={s.card}>
        <View style={s.question}>
          <Text style={s.qIcon}>✅</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.qLabel}>O que funcionou bem?</Text>
            <TextInput
              style={s.input}
              value={whatWorked}
              onChangeText={setWhatWorked}
              placeholder={isDiet
                ? 'Ex: Adorei os almoços, eram práticos...'
                : 'Ex: Os treinos de perna foram ótimos...'}
              placeholderTextColor={Colors.text3}
              multiline
              maxLength={300}
            />
          </View>
        </View>

        <View style={s.question}>
          <Text style={s.qIcon}>❌</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.qLabel}>O que não funcionou?</Text>
            <TextInput
              style={s.input}
              value={whatDidnt}
              onChangeText={setWhatDidnt}
              placeholder={isDiet
                ? 'Ex: O jantar era pesado demais...'
                : 'Ex: Não consegui fazer o treino de quarta...'}
              placeholderTextColor={Colors.text3}
              multiline
              maxLength={300}
            />
          </View>
        </View>

        <View style={[s.question, { borderBottomWidth: 0 }]}>
          <Text style={s.qIcon}>💡</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.qLabel}>O que quer mudar no próximo?</Text>
            <TextInput
              style={s.input}
              value={wantsToChange}
              onChangeText={setWantsToChange}
              placeholder={isDiet
                ? 'Ex: Menos carboidratos à noite, mais frango...'
                : 'Ex: Mais foco em costas e bíceps...'}
              placeholderTextColor={Colors.text3}
              multiline
              maxLength={300}
            />
          </View>
        </View>
      </View>

      {/* Botões */}
      <TouchableOpacity
        style={[s.generateBtn, generating && { opacity: 0.7 }]}
        onPress={() => handleGenerate(true)}
        disabled={generating}
      >
        {generating
          ? <ActivityIndicator color={Colors.bg} />
          : (
            <View style={{ alignItems: 'center' }}>
              <Text style={s.generateText}>✨ Gerar plano com meu feedback</Text>
              <Text style={s.generateSub}>A IA vai usar suas respostas para personalizar</Text>
            </View>
          )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.skipBtn, generating && { opacity: 0.5 }]}
        onPress={() => handleGenerate(false)}
        disabled={generating}
      >
        <Text style={s.skipText}>Pular e gerar sem feedback</Text>
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
