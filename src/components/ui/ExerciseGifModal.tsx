import React, { useState } from 'react'
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Dimensions,
} from 'react-native'
import { Image } from 'expo-image'
import { Colors, Radius } from '@constants/index'
import { fetchExerciseGif } from '@services/ai'
import type { ExerciseGifData } from '@services/ai'

const { width: SCREEN_W } = Dimensions.get('window')
const GIF_SIZE = SCREEN_W - 80

const MUSCLE_PT: Record<string, string> = {
  chest: 'Peito', back: 'Costas', shoulders: 'Ombros', biceps: 'Bíceps',
  triceps: 'Tríceps', 'upper arms': 'Braços', forearms: 'Antebraço',
  abs: 'Abdômen', 'upper legs': 'Coxas', 'lower legs': 'Panturrilhas',
  glutes: 'Glúteos', waist: 'Cintura', cardiovascular: 'Cardio', neck: 'Pescoço',
}
const EQUIP_PT: Record<string, string> = {
  barbell: 'Barra', dumbbell: 'Haltere', 'body weight': 'Peso corporal',
  cable: 'Cabo', machine: 'Máquina', kettlebell: 'Kettlebell',
  band: 'Elástico', 'ez barbell': 'Barra EZ', leverage: 'Aparelho',
  'resistance band': 'Elástico', rope: 'Corda', assisted: 'Assistido',
  other: 'Outro',
}

interface Props {
  exerciseName:  string    // PT name (for display)
  searchName:    string    // EN name (for lookup)
  bodyPart?:     string    // EN body part (fallback lookup)
  visible:       boolean
  onClose:       () => void
}

export default function ExerciseGifModal({ exerciseName, searchName, bodyPart, visible, onClose }: Props) {
  const [loading,  setLoading]  = useState(false)
  const [data,     setData]     = useState<ExerciseGifData | null | 'not_found'>(null)
  const [fetched,  setFetched]  = useState(false)

  // Busca ao abrir (só uma vez por searchName)
  const handleOpen = async () => {
    if (fetched) return
    setLoading(true)
    try {
      const result = await fetchExerciseGif(searchName, bodyPart)
      setData(result ?? 'not_found')
    } catch {
      setData('not_found')
    } finally {
      setLoading(false)
      setFetched(true)
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />

      <View style={s.sheet}>
        {/* Handle */}
        <View style={s.handle} />

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title} numberOfLines={2}>{exerciseName}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
          {loading && (
            <View style={s.center}>
              <ActivityIndicator size="large" color={Colors.accent} />
              <Text style={s.loadingText}>Buscando demonstração...</Text>
            </View>
          )}

          {!loading && data === 'not_found' && (
            <View style={s.center}>
              <Text style={s.notFoundEmoji}>🏋️</Text>
              <Text style={s.notFoundText}>Demonstração não encontrada</Text>
              <Text style={s.notFoundSub}>
                Use a dica ℹ na tela do treino para ver as instruções em texto.
              </Text>
            </View>
          )}

          {!loading && data && data !== 'not_found' && (
            <>
              {/* GIF animado */}
              <View style={s.gifWrap}>
                <Image
                  source={{ uri: data.gifUrl }}
                  style={s.gif}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              </View>

              {/* Badges */}
              <View style={s.badges}>
                {data.targetMuscle ? (
                  <View style={s.badge}>
                    <Text style={s.badgeLabel}>🎯 Alvo</Text>
                    <Text style={s.badgeVal}>
                      {MUSCLE_PT[data.targetMuscle] ?? data.targetMuscle}
                    </Text>
                  </View>
                ) : null}
                {data.equipment ? (
                  <View style={s.badge}>
                    <Text style={s.badgeLabel}>🔧 Equipamento</Text>
                    <Text style={s.badgeVal}>
                      {EQUIP_PT[data.equipment] ?? data.equipment}
                    </Text>
                  </View>
                ) : null}
                {data.bodyPart ? (
                  <View style={s.badge}>
                    <Text style={s.badgeLabel}>💪 Grupo</Text>
                    <Text style={s.badgeVal}>
                      {MUSCLE_PT[data.bodyPart] ?? data.bodyPart}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Instruções passo a passo */}
              {data.instructions.length > 0 && (
                <View style={s.instructionsCard}>
                  <Text style={s.instructionsTitle}>Como executar</Text>
                  {data.instructions.map((step, i) => (
                    <View key={i} style={s.step}>
                      <View style={s.stepNum}>
                        <Text style={s.stepNumText}>{i + 1}</Text>
                      </View>
                      <Text style={s.stepText}>{step}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:             { backgroundColor: Colors.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', paddingBottom: 40 },
  handle:            { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title:             { flex: 1, fontSize: 17, fontWeight: '800', color: Colors.text, marginRight: 12 },
  closeBtn:          { fontSize: 16, color: Colors.text3, fontWeight: '700' },
  body:              { padding: 20, gap: 16 },
  center:            { alignItems: 'center', paddingVertical: 40, gap: 10 },
  loadingText:       { fontSize: 13, color: Colors.text2 },
  notFoundEmoji:     { fontSize: 48 },
  notFoundText:      { fontSize: 15, fontWeight: '700', color: Colors.text },
  notFoundSub:       { fontSize: 13, color: Colors.text2, textAlign: 'center', lineHeight: 18 },
  gifWrap:           { backgroundColor: Colors.bg3, borderRadius: Radius.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  gif:               { width: GIF_SIZE, height: GIF_SIZE * 0.75 },
  badges:            { flexDirection: 'row', gap: 8 },
  badge:             { flex: 1, backgroundColor: Colors.bg3, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.border },
  badgeLabel:        { fontSize: 10, color: Colors.text3, marginBottom: 3 },
  badgeVal:          { fontSize: 12, fontWeight: '700', color: Colors.text, textTransform: 'capitalize' },
  instructionsCard:  { backgroundColor: Colors.bg3, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border },
  instructionsTitle: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  step:              { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  stepNum:           { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  stepNumText:       { fontSize: 11, fontWeight: '800', color: Colors.bg },
  stepText:          { flex: 1, fontSize: 13, color: Colors.text2, lineHeight: 19 },
})
