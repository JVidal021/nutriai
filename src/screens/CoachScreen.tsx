import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native'
import { Colors, Spacing, Radius } from '@constants/index'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCoachStore, useUserStore, useNutritionStore, useProgressStore, useWorkoutStore } from '@store/index'
import { sendCoachMessage, swapPlanItem } from '@services/ai'
import type { ChatMessage, PlannedMeal, WorkoutSession } from '@types/index'

const QUICK_MSGS = [
  'Quais alimentos têm mais proteína?',
  'Como melhorar meu sono?',
  'Devo tomar suplemento?',
  'Analise meu progresso desta semana',
]

type SupportType = 'quit' | 'cheat' | 'routine' | 'food'

const SUPPORT_CHIPS: { type: SupportType; emoji: string; label: string }[] = [
  { type: 'quit',    emoji: '😔', label: 'Tô querendo desistir'  },
  { type: 'cheat',   emoji: '🍕', label: 'Escapei da dieta hoje' },
  { type: 'routine', emoji: '😩', label: 'Não consigo criar rotina' },
  { type: 'food',    emoji: '🍽️', label: 'Não sei o que comer'   },
]

export default function CoachScreen() {
  const insets = useSafeAreaInsets()
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [applyingSwap, setApplying] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  const { user, isLoading }                                            = useUserStore()
  const { messages, addMessage, planContext, setPlanContext }          = useCoachStore()
  const { getTodayTotals, weekPlan, swapMeal }                        = useNutritionStore()
  const { progress }                                                   = useProgressStore()
  const { getTodayWorkout, swapWorkoutDay }                           = useWorkoutStore()

  if (isLoading || !user) return null

  const todayPlan    = weekPlan.find(d => d.date === new Date().toISOString().split('T')[0])
  const totals       = getTodayTotals()
  const todayWorkout = getTodayWorkout()

  // ID of the last assistant message (for "Apply" button placement)
  const lastAIMessageId = [...messages].reverse().find(m => m.role === 'assistant')?.id

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }, [messages])

  const handleSend = async (text: string) => {
    const msg = text.trim()
    if (!msg || loading) return

    setInput('')
    setLoading(true)

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    }
    addMessage(userMsg)

    try {
      const response = await sendCoachMessage(
        msg,
        messages,
        {
          todayCalories:  totals.calories,
          targetCalories: todayPlan?.targetMacros.calories ?? 1650,
          workoutDone:    !!todayWorkout?.completed,
          streak:         progress.streak,
        },
        planContext,
      )

      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      })
    } catch {
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Desculpe, não consegui processar sua mensagem. Verifique sua conexão e tente novamente. 🌿',
        timestamp: new Date().toISOString(),
      })
    } finally {
      setLoading(false)
    }
  }

  // Build a rich, contextual support message from the user's real data
  const buildSupportMessage = (type: SupportType): string => {
    const goalLabel =
      user?.goal === 'lose_weight'  ? 'emagrecer' :
      user?.goal === 'gain_muscle'  ? 'ganhar massa muscular' :
      user?.goal === 'performance'  ? 'melhorar minha performance' :
      'manter o peso'
    const kgLost = progress.weightLost > 0
      ? `Já perdi ${progress.weightLost.toFixed(1)} kg`
      : 'Ainda não registrei perda de peso'
    const streak = progress.streak

    switch (type) {
      case 'quit':
        return (
          `Tô com muita vontade de desistir. Meu objetivo é ${goalLabel} e ${kgLost.toLowerCase()}, ` +
          `mas tô desmotivado(a) e achando que não vale a pena continuar. ` +
          `${streak > 0 ? `Meu streak atual é de ${streak} dia${streak > 1 ? 's' : ''}.` : 'Meu streak está zerado.'} ` +
          `Me dá um apoio real — não quero ouvir clichê, quero razões concretas para não largar agora.`
        )
      case 'cheat':
        return (
          `Escapei da dieta hoje e comi coisas que não deveria. Tô me sentindo culpado(a) e com medo de ` +
          `ter estragado tudo que conquistei. ${kgLost}. Meu objetivo é ${goalLabel}. ` +
          `O que faço agora para me recuperar e voltar nos trilhos sem ficar sofrendo por isso?`
        )
      case 'routine':
        return (
          `Não consigo criar uma rotina de dieta e treino. Fico bem por alguns dias e depois largo tudo, ` +
          `e fica esse ciclo sem fim. ${kgLost}. Meu objetivo é ${goalLabel}. ` +
          `${streak > 0 ? `Meu streak é de ${streak} dia${streak > 1 ? 's' : ''}, mas não dura.` : 'Meu streak sempre zera.'} ` +
          `O que posso fazer de diferente para criar um hábito que realmente dure?`
        )
      case 'food':
        return (
          `Não sei o que comer no dia a dia. Meu objetivo é ${goalLabel}, mas fico perdido(a) na hora de ` +
          `montar o prato, escolher o lanche, saber o que pode e o que não pode. ` +
          `Me dá um guia bem prático e simples — sem termos difíceis — do que comer nas principais refeições do dia.`
        )
    }
  }

  // Apply the last AI suggestion directly to the plan
  const handleApply = async () => {
    if (!planContext) return
    const lastAI = [...messages].reverse().find(m => m.role === 'assistant')
    if (!lastAI) return

    setApplying(true)
    try {
      const newItem = await swapPlanItem(
        planContext.type === 'diet' ? 'meal' : 'workout',
        planContext.item as unknown as Record<string, unknown>,
        planContext.date,
        lastAI.content,
      )

      if (planContext.type === 'diet') {
        swapMeal(
          planContext.date,
          planContext.mealType!,
          newItem as unknown as PlannedMeal,
        )
      } else {
        swapWorkoutDay(
          planContext.date,
          newItem as unknown as WorkoutSession,
        )
      }

      setPlanContext(null)
      Alert.alert('✅ Plano atualizado!', 'A sugestão do Coach foi aplicada ao seu plano.')
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Tente novamente.')
    } finally {
      setApplying(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.headerLeft}>
          <View style={s.avatarAI}><Text style={{ fontSize: 18 }}>🌿</Text></View>
          <View>
            <Text style={s.headerTitle}>Coach NutriAI</Text>
            <View style={s.onlineRow}>
              <View style={s.onlineDot} />
              <Text style={s.onlineText}>Online agora</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Plan context banner — shown when navigated from Diet/Workout screen */}
      {planContext && (
        <View style={s.contextBanner}>
          <Text style={s.contextText} numberOfLines={1}>
            📋 {planContext.label}
          </Text>
          <TouchableOpacity onPress={() => setPlanContext(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.contextClose}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={s.messages}
        contentContainerStyle={s.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => (
          <View key={msg.id}>
            <View style={[s.msgWrap, msg.role === 'user' ? s.msgWrapUser : s.msgWrapAI]}>
              {msg.role === 'assistant' && (
                <View style={s.aiAvatar}><Text style={{ fontSize: 14 }}>🌿</Text></View>
              )}
              <View style={[s.bubble, msg.role === 'user' ? s.bubbleUser : s.bubbleAI]}>
                <Text style={[s.bubbleText, msg.role === 'user' && s.bubbleTextUser]}>
                  {msg.content}
                </Text>
              </View>
            </View>

            {/* "Apply to plan" button — shown below the last AI message when planContext is set */}
            {msg.id === lastAIMessageId && planContext && !loading && (
              <TouchableOpacity
                style={[s.applyBtn, applyingSwap && { opacity: 0.6 }]}
                onPress={handleApply}
                disabled={applyingSwap}
              >
                {applyingSwap
                  ? <ActivityIndicator size="small" color={Colors.bg} />
                  : <Text style={s.applyBtnText}>✅ Aplicar sugestão ao plano →</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        ))}

        {loading && (
          <View style={[s.msgWrap, s.msgWrapAI]}>
            <View style={s.aiAvatar}><Text style={{ fontSize: 14 }}>🌿</Text></View>
            <View style={[s.bubble, s.bubbleAI]}>
              <ActivityIndicator size="small" color={Colors.text2} />
            </View>
          </View>
        )}
      </ScrollView>

      {messages.length <= 2 && (
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={s.quickScroll} contentContainerStyle={s.quickRow}
        >
          {QUICK_MSGS.map(q => (
            <TouchableOpacity key={q} style={s.quickBtn} onPress={() => handleSend(q)}>
              <Text style={s.quickText}>{q}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {messages.length <= 4 && (
        <View style={s.supportSection}>
          <Text style={s.supportLabel}>💙 Precisa de apoio?</Text>
          <View style={s.supportRow}>
            {SUPPORT_CHIPS.map(chip => (
              <TouchableOpacity
                key={chip.type}
                style={s.supportChip}
                onPress={() => handleSend(buildSupportMessage(chip.type))}
                disabled={loading}
              >
                <Text style={s.supportChipEmoji}>{chip.emoji}</Text>
                <Text style={s.supportChipText}>{chip.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="Escreva uma mensagem..."
          placeholderTextColor={Colors.text3}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!input.trim() || loading) && { opacity: 0.4 }]}
          onPress={() => handleSend(input)}
          disabled={!input.trim() || loading}
        >
          {loading
            ? <ActivityIndicator size="small" color={Colors.bg} />
            : <Text style={s.sendIcon}>↑</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: Colors.bg },
  header:          { flexDirection: 'row', alignItems: 'center', padding: Spacing[5], borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerLeft:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarAI:        { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  headerTitle:     { fontSize: 16, fontWeight: '700', color: Colors.text },
  onlineRow:       { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.teal },
  onlineText:      { fontSize: 11, color: Colors.teal },
  // Plan context banner
  contextBanner:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing[5], paddingVertical: 8, backgroundColor: Colors.teal + '18', borderBottomWidth: 1, borderBottomColor: Colors.teal + '30' },
  contextText:     { flex: 1, fontSize: 12, fontWeight: '600', color: Colors.teal, marginRight: 8 },
  contextClose:    { fontSize: 14, color: Colors.teal, fontWeight: '700' },
  // Messages
  messages:        { flex: 1 },
  messagesContent: { padding: Spacing[4], gap: 12, paddingBottom: 8 },
  msgWrap:         { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  msgWrapUser:     { justifyContent: 'flex-end' },
  msgWrapAI:       { justifyContent: 'flex-start' },
  aiAvatar:        { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bubble:          { maxWidth: '85%', borderRadius: 16, padding: 12, minHeight: 36, justifyContent: 'center' },
  bubbleAI:        { backgroundColor: Colors.bg3, borderBottomLeftRadius: 4 },
  bubbleUser:      { backgroundColor: Colors.accent, borderBottomRightRadius: 4 },
  bubbleText:      { fontSize: 14, color: Colors.text, lineHeight: 20 },
  bubbleTextUser:  { color: Colors.bg, fontWeight: '500' },
  // Apply suggestion button
  applyBtn:        { alignSelf: 'flex-start', marginLeft: 36, marginTop: 6, backgroundColor: Colors.teal, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  applyBtnText:    { fontSize: 12, fontWeight: '700', color: Colors.bg },
  // Quick messages
  quickScroll:     { maxHeight: 48 },
  quickRow:        { paddingHorizontal: Spacing[4], gap: 8, paddingVertical: 6 },
  quickBtn:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: Colors.border2 },
  quickText:       { fontSize: 12, color: Colors.text2 },
  // Support section
  supportSection:  { paddingHorizontal: Spacing[4], paddingTop: 10, paddingBottom: 4, borderTopWidth: 1, borderTopColor: Colors.border },
  supportLabel:    { fontSize: 11, fontWeight: '600', color: Colors.text3, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  supportRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  supportChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.teal + '40' },
  supportChipEmoji:{ fontSize: 14 },
  supportChipText: { fontSize: 12, fontWeight: '500', color: Colors.teal },
  // Input
  inputRow:        { flexDirection: 'row', gap: 8, padding: Spacing[4], paddingBottom: 32, borderTopWidth: 1, borderTopColor: Colors.border, alignItems: 'flex-end' },
  input:           { flex: 1, backgroundColor: Colors.bg3, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.border2, maxHeight: 100 },
  sendBtn:         { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  sendIcon:        { fontSize: 18, fontWeight: '700', color: Colors.bg },
})
