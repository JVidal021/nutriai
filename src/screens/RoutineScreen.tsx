import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius } from '@constants/index'
import { useProgressStore, useUserStore } from '@store/index'
import { calcTMB, calcTDEE, calcTargetCalories } from '@utils/index'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function RoutineScreen() {
  const insets  = useSafeAreaInsets()
  const { user } = useUserStore()
  const { getTodayCheckin } = useProgressStore()
  const checkin = getTodayCheckin()
  const isTired = checkin?.mood === 'tired' || checkin?.mood === 'exhausted'

  // Meta calórica calculada a partir do perfil real do usuário
  const baseCalories = user
    ? calcTargetCalories(
        calcTDEE(
          calcTMB(user.weight, user.height, user.age, user.gender),
          user.activityLevel
        ),
        user.goal
      )
    : 2000

  const blocks = [
    {
      emoji: '🔥',
      title: 'Aquecimento',
      sub: '10 min · obrigatório',
      statusLabel: 'Fixo',
      statusColor: Colors.teal,
      statusBg: Colors.teal + '18',
      adapted: false,
    },
    {
      emoji: isTired ? '🧘' : '💪',
      title: isTired ? 'Mobilidade + Alongamento' : 'Peito + Tríceps',
      sub: isTired ? '25 min · adaptado automaticamente' : '50 min · treino principal',
      statusLabel: isTired ? 'Adaptado' : 'Principal',
      statusColor: isTired ? Colors.accent : Colors.purple,
      statusBg: isTired ? Colors.accent + '18' : Colors.purple + '18',
      adapted: isTired,
    },
    {
      emoji: isTired ? '🚶' : '🏃',
      title: isTired ? 'Caminhada leve' : 'Cardio moderado',
      sub: `${isTired ? 20 : 15} min · ${isTired ? 'adicionado pela IA' : 'finalização'}`,
      statusLabel: 'IA',
      statusColor: Colors.orange,
      statusBg: Colors.orange + '18',
      adapted: false,
    },
    {
      emoji: '❄️',
      title: 'Resfriamento',
      sub: '5 min · sempre ao final',
      statusLabel: 'Fixo',
      statusColor: Colors.teal,
      statusBg: Colors.teal + '18',
      adapted: false,
    },
  ]

  const handleStart = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    Alert.alert('Rotina iniciada!', 'Boa sorte no treino de hoje 💪')
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>⚡ Rotina Modular</Text>
      <Text style={s.sub}>Adaptada em tempo real com base no seu check-in</Text>

      {isTired && checkin?.adaptations && (
        <View style={s.adaptBanner}>
          <Text style={s.adaptText}>
            🧠 Rotina recalculada — check-in: {checkin.moodEmoji} {checkin.adaptations.message}
          </Text>
        </View>
      )}

      <View style={s.card}>
        <Text style={s.cardTitle}>Como a IA cuida de você</Text>
        {[
          { emoji: '😔', title: 'Quando você está cansado', desc: 'O treino do dia fica mais leve e o jantar é ajustado para o menor gasto calórico.' },
          { emoji: '📅', title: 'Quando um treino foi pulado', desc: 'A IA inclui uma sessão de reposição equilibrada no dia seguinte.' },
          { emoji: '🔥', title: 'Com 7+ dias de sequência', desc: 'Treinos mais desafiadores são desbloqueados e uma semana de recuperação é sugerida.' },
        ].map(rule => (
          <View key={rule.title} style={s.ruleRow}>
            <Text style={s.ruleEmoji}>{rule.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.ruleTitle}>{rule.title}</Text>
              <Text style={s.ruleDesc}>{rule.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {isTired && checkin?.adaptations && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Ajuste calórico de hoje</Text>
          <View style={s.adjustRow}>
            <Text style={s.adjustLabel}>Meta original</Text>
            <Text style={[s.adjustVal, { textDecorationLine: 'line-through', color: Colors.text3 }]}>
              {baseCalories.toLocaleString('pt-BR')} kcal
            </Text>
          </View>
          <View style={s.adjustRow}>
            <Text style={s.adjustLabel}>Ajuste (treino leve)</Text>
            <Text style={[s.adjustVal, { color: Colors.orange }]}>{checkin.adaptations.caloriesAdjusted} kcal</Text>
          </View>
          <View style={[s.adjustRow, { borderBottomWidth: 0 }]}>
            <Text style={[s.adjustLabel, { fontWeight: '700', color: Colors.text }]}>Nova meta</Text>
            <Text style={[s.adjustVal, { color: Colors.accent, fontSize: 18 }]}>
              {(baseCalories + (checkin.adaptations.caloriesAdjusted ?? 0)).toLocaleString('pt-BR')} kcal
            </Text>
          </View>
        </View>
      )}

      <Text style={[s.cardTitle, { marginBottom: 8 }]}>Blocos de hoje</Text>
      {blocks.map((block, i) => (
        <View key={i} style={[s.blockCard, block.adapted && s.blockAdapted]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <Text style={{ fontSize: 22 }}>{block.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.blockTitle}>{block.title}</Text>
              <Text style={s.blockSub}>{block.sub}</Text>
              {block.adapted && (
                <Text style={s.blockOriginal}>Original: Peito + Tríceps · substituído pelo check-in</Text>
              )}
            </View>
            <View style={[s.blockBadge, { backgroundColor: block.statusBg }]}>
              <Text style={[s.blockBadgeText, { color: block.statusColor }]}>{block.statusLabel}</Text>
            </View>
          </View>
        </View>
      ))}

      <TouchableOpacity style={s.startBtn} onPress={handleStart}>
        <Text style={s.startBtnText}>▶ Iniciar rotina adaptada</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: Colors.bg },
  content:        { padding: Spacing[5], paddingBottom: 100 },
  title:          { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  sub:            { fontSize: 13, color: Colors.text2, marginBottom: 16 },
  adaptBanner:    { backgroundColor: Colors.accent + '14', borderRadius: Radius.lg, padding: 13, marginBottom: 12, borderWidth: 1, borderColor: Colors.accent + '30' },
  adaptText:      { fontSize: 13, color: Colors.accent, lineHeight: 18 },
  card:           { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  cardTitle:      { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 12 },
  ruleRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  ruleEmoji:      { fontSize: 20 },
  ruleTitle:      { fontSize: 13, fontWeight: '600', color: Colors.text },
  ruleDesc:       { fontSize: 11, color: Colors.text2, marginTop: 2, lineHeight: 16 },
  adjustRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  adjustLabel:    { fontSize: 13, color: Colors.text2 },
  adjustVal:      { fontSize: 14, fontWeight: '600', color: Colors.text },
  blockCard:      { backgroundColor: Colors.bg2, borderRadius: Radius.md, padding: 13, borderWidth: 1, borderColor: Colors.border, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: Colors.border2 },
  blockAdapted:   { borderLeftColor: Colors.accent, backgroundColor: '#111800' },
  blockTitle:     { fontSize: 13, fontWeight: '600', color: Colors.text },
  blockSub:       { fontSize: 11, color: Colors.text2, marginTop: 2 },
  blockOriginal:  { fontSize: 10, color: Colors.text3, marginTop: 3 },
  blockBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  blockBadgeText: { fontSize: 10, fontWeight: '700' },
  startBtn:       { backgroundColor: Colors.accent, borderRadius: Radius.md, padding: 14, alignItems: 'center', marginTop: 4 },
  startBtnText:   { fontSize: 15, fontWeight: '700', color: Colors.bg },
})
