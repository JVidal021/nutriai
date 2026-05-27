import React from 'react'
import {
  Modal, View, Text, StyleSheet,
  ScrollView, TouchableOpacity,
} from 'react-native'
import { Colors, Radius, Spacing } from '@constants/index'
import { findExercise } from '@data/exercises'

interface Props {
  exerciseName: string | null
  onClose: () => void
}

const MUSCLE_EMOJI: Record<string, string> = {
  'Quadríceps': '🦵', 'Glúteos': '🍑', 'Isquiotibiais': '🦵',
  'Peitoral': '💪', 'Peitoral maior': '💪', 'Peitoral superior': '💪',
  'Grande dorsal': '🔙', 'Latíssimo': '🔙', 'Rombóide': '🔙',
  'Deltóide médio': '💪', 'Deltóide anterior': '💪',
  'Bíceps': '💪', 'Bíceps braquial': '💪',
  'Tríceps': '💪', 'Tríceps braquial': '💪',
  'Core': '🧘', 'Reto abdominal': '🧘', 'Oblíquos': '🧘',
  'Glúteo máximo': '🍑', 'Adutores': '🦵',
  'Lombar': '🔙', 'Trapézio': '🔙',
  'Gastrocnêmio': '🦵', 'Sóleo': '🦵',
  'Corpo todo': '🔥',
}

const DIFFICULTY_COLOR: Record<string, string> = {
  'iniciante':     Colors.teal,
  'intermediário': Colors.orange,
  'avançado':      Colors.red,
}

export default function ExerciseModal({ exerciseName, onClose }: Props) {
  if (!exerciseName) return null

  const info = findExercise(exerciseName)

  return (
    <Modal
      visible={!!exerciseName}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Handle bar */}
          <View style={s.handle} />

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={s.header}>
              <Text style={s.emoji}>{info?.emoji ?? '🏋️'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{exerciseName}</Text>
                {info && (
                  <View style={s.badgeRow}>
                    <View style={[s.badge, { backgroundColor: DIFFICULTY_COLOR[info.difficulty] + '20' }]}>
                      <Text style={[s.badgeText, { color: DIFFICULTY_COLOR[info.difficulty] }]}>
                        {info.difficulty}
                      </Text>
                    </View>
                    <View style={s.equipBadge}>
                      <Text style={s.equipText}>🏗️ {info.equipment}</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {!info ? (
              // Exercício não encontrado no banco — mensagem amigável
              <View style={s.notFoundBox}>
                <Text style={s.notFoundText}>
                  Informações detalhadas deste exercício ainda não estão no banco.{'\n\n'}
                  💡 Dica: pesquise "{exerciseName}" no YouTube para ver a execução correta.
                </Text>
              </View>
            ) : (
              <>
                {/* Músculos */}
                <View style={s.section}>
                  <Text style={s.sectionTitle}>Músculos trabalhados</Text>
                  <View style={s.muscleRow}>
                    {info.muscles.map(m => (
                      <View key={m} style={s.muscleChip}>
                        <Text style={s.muscleEmoji}>{MUSCLE_EMOJI[m] ?? '💪'}</Text>
                        <Text style={s.muscleText}>{m}</Text>
                      </View>
                    ))}
                  </View>
                  {info.secondary.length > 0 && (
                    <>
                      <Text style={[s.sectionTitle, { marginTop: 8, fontSize: 11, color: Colors.text3 }]}>
                        Secundários
                      </Text>
                      <View style={s.muscleRow}>
                        {info.secondary.map(m => (
                          <View key={m} style={[s.muscleChip, s.muscleChipSecondary]}>
                            <Text style={[s.muscleText, { color: Colors.text3 }]}>{m}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </View>

                {/* Como executar */}
                <View style={s.section}>
                  <Text style={s.sectionTitle}>Como executar</Text>
                  <Text style={s.howText}>{info.how}</Text>
                </View>

                {/* Dica */}
                <View style={[s.section, s.tipBox]}>
                  <Text style={s.tipIcon}>💡</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.tipTitle}>Dica de ouro</Text>
                    <Text style={s.tipText}>{info.tip}</Text>
                  </View>
                </View>

                {/* Erro comum */}
                <View style={[s.section, s.mistakeBox]}>
                  <Text style={s.tipIcon}>⚠️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.tipTitle, { color: Colors.orange }]}>Erro mais comum</Text>
                    <Text style={s.tipText}>{info.mistake}</Text>
                  </View>
                </View>
              </>
            )}
          </ScrollView>

          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>Entendido ✓</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay:             { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet:               { backgroundColor: Colors.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing[5], paddingBottom: 40, maxHeight: '88%' },
  handle:              { width: 40, height: 4, backgroundColor: Colors.border2, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  header:              { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 16 },
  emoji:               { fontSize: 40 },
  name:                { fontSize: 20, fontWeight: '800', color: Colors.text, flex: 1, flexWrap: 'wrap' },
  badgeRow:            { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  badge:               { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText:           { fontSize: 11, fontWeight: '700' },
  equipBadge:          { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, backgroundColor: Colors.bg3 },
  equipText:           { fontSize: 11, color: Colors.text2 },
  notFoundBox:         { backgroundColor: Colors.bg3, borderRadius: Radius.lg, padding: 20, alignItems: 'center' },
  notFoundText:        { fontSize: 14, color: Colors.text2, textAlign: 'center', lineHeight: 22 },
  section:             { marginBottom: 16 },
  sectionTitle:        { fontSize: 12, fontWeight: '700', color: Colors.text2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  muscleRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muscleChip:          { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.accent + '15', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.accent + '30' },
  muscleChipSecondary: { backgroundColor: Colors.bg3, borderColor: Colors.border },
  muscleEmoji:         { fontSize: 14 },
  muscleText:          { fontSize: 12, fontWeight: '600', color: Colors.accent },
  howText:             { fontSize: 14, color: Colors.text, lineHeight: 22 },
  tipBox:              { flexDirection: 'row', gap: 10, backgroundColor: Colors.teal + '12', borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: Colors.teal + '30' },
  mistakeBox:          { flexDirection: 'row', gap: 10, backgroundColor: Colors.orange + '12', borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: Colors.orange + '30' },
  tipIcon:             { fontSize: 20 },
  tipTitle:            { fontSize: 12, fontWeight: '700', color: Colors.teal, marginBottom: 3 },
  tipText:             { fontSize: 13, color: Colors.text, lineHeight: 19 },
  closeBtn:            { backgroundColor: Colors.accent, borderRadius: Radius.md, padding: 14, alignItems: 'center', marginTop: 8 },
  closeBtnText:        { fontSize: 15, fontWeight: '700', color: Colors.bg },
})
