import React from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { Colors, Spacing, Radius } from '@constants/index'
import { useProgressStore, useUserStore } from '@store/index'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { calcEfficiencyScore, weeksToGoal } from '@utils/index'

export default function OptimizeScreen() {
  const insets = useSafeAreaInsets()
  const { user, isLoading } = useUserStore()
  const { progress } = useProgressStore()

  if (isLoading || !user) return null

  const efficiency = calcEfficiencyScore({
    adherencePercent:   progress.adherencePercent,
    streak:             progress.streak,
    avgSleepHours:      7.3,
    avgHydrationLiters: 1.8,
  })

  const weeks = user ? weeksToGoal(user.weight, user.targetWeight) : 0

  const patterns = [
    { color: Colors.teal,   title: 'Melhor desempenho às quartas',         desc: 'Seus treinos de Qua têm 18% mais carga. Coloque o treino mais pesado neste dia.'        },
    { color: Colors.orange, title: 'Excesso calórico recorrente às sextas', desc: 'Média +280 kcal acima da meta. A IA ajusta seu jantar de quinta automaticamente.'        },
    { color: Colors.purple, title: 'Sono impacta o desempenho',             desc: 'Dias com < 6h reduzem gasto calórico em ~22%. Correlação: 0,84.'                        },
    { color: Colors.red,    title: 'Hidratação abaixo do ideal',            desc: '6 dos últimos 10 dias abaixo de 2L. Impacto estimado: −5% de eficiência.'               },
  ]

  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>📊 Otimização</Text>
      <Text style={s.sub}>Seu metabolismo como um sistema lógico</Text>

      <View style={s.scoreCard}>
        <Text style={s.scoreSub}>Índice de Eficiência Metabólica</Text>
        <Text style={s.scoreNum}>{efficiency}</Text>
        <Text style={s.scoreLabel}>/ 100 · Sistema {efficiency >= 80 ? 'Eficiente' : efficiency >= 60 ? 'Em progresso' : 'Precisa de atenção'}</Text>
        <View style={s.scoreBar}>
          <View style={[s.scoreBarFill, { flex: efficiency / 100 }]} />
        </View>
        <Text style={s.scoreFooter}>
          Mantendo o ritmo atual, você atinge a meta em{' '}
          <Text style={{ color: Colors.accent, fontWeight: '700' }}>{weeks} semanas</Text>
        </Text>
      </View>

      <View style={s.metricsGrid}>
        {[
          { label: 'kcal/treino',   val: '+340',            color: Colors.purple },
          { label: 'ritmo/semana',  val: '−0,4kg',          color: Colors.teal   },
          { label: 'aderência',     val: `${progress.adherencePercent}%`, color: Colors.accent },
          { label: 'dias p/ meta',  val: String(weeks * 7), color: Colors.orange },
        ].map(m => (
          <View key={m.label} style={s.metricBox}>
            <Text style={[s.metricVal, { color: m.color }]}>{m.val}</Text>
            <Text style={s.metricLbl}>{m.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Padrões detectados pela IA</Text>
        {patterns.map(p => (
          <View key={p.title} style={s.patternRow}>
            <View style={[s.patternDot, { backgroundColor: p.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.patternTitle}>{p.title}</Text>
              <Text style={s.patternDesc}>{p.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Simulação: +1 treino/semana</Text>
        <View style={s.scenarioRow}>
          {[
            { val: '−3 sem',  label: 'para atingir meta',   color: Colors.teal   },
            { val: String(Math.min(efficiency + 5, 100)), label: 'nova eficiência', color: Colors.accent },
            { val: '+340',    label: 'kcal extra/semana',    color: Colors.purple },
          ].map(item => (
            <View key={item.label} style={s.scenarioBox}>
              <Text style={[s.scenarioVal, { color: item.color }]}>{item.val}</Text>
              <Text style={s.scenarioLbl}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: Colors.bg },
  content:       { padding: Spacing[5], paddingBottom: 100 },
  title:         { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  sub:           { fontSize: 13, color: Colors.text2, marginBottom: 16 },
  scoreCard:     { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 20, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', marginBottom: 12 },
  scoreSub:      { fontSize: 12, color: Colors.text2, marginBottom: 4 },
  scoreNum:      { fontSize: 56, fontWeight: '800', color: Colors.accent, lineHeight: 60 },
  scoreLabel:    { fontSize: 13, color: Colors.teal, marginBottom: 10 },
  scoreBar:      { width: '100%', height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden', marginBottom: 10, flexDirection: 'row' },
  scoreBarFill:  { backgroundColor: Colors.accent },
  scoreFooter:   { fontSize: 13, color: Colors.text2, textAlign: 'center' },
  metricsGrid:   { flexDirection: 'row', gap: 8, marginBottom: 10 },
  metricBox:     { flex: 1, backgroundColor: Colors.bg2, borderRadius: Radius.md, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  metricVal:     { fontSize: 16, fontWeight: '700' },
  metricLbl:     { fontSize: 9, color: Colors.text2, marginTop: 2, textAlign: 'center' },
  card:          { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  cardTitle:     { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 12 },
  patternRow:    { flexDirection: 'row', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  patternDot:    { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  patternTitle:  { fontSize: 13, fontWeight: '500', color: Colors.text },
  patternDesc:   { fontSize: 11, color: Colors.text2, marginTop: 2, lineHeight: 16 },
  scenarioRow:   { flexDirection: 'row', gap: 8 },
  scenarioBox:   { flex: 1, backgroundColor: Colors.bg3, borderRadius: 10, padding: 10, alignItems: 'center' },
  scenarioVal:   { fontSize: 16, fontWeight: '700' },
  scenarioLbl:   { fontSize: 9, color: Colors.text2, marginTop: 2, textAlign: 'center' },
})
