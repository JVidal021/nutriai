import React, { useState } from 'react'
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, ActivityIndicator,
} from 'react-native'
import { Colors, Radius, Spacing } from '@constants/index'

const MEAL_REASONS = [
  { id: 'no_ingredient',  label: '🥦 Não tenho esse ingrediente' },
  { id: 'more_practical', label: '⚡ Quero algo mais prático e rápido' },
  { id: 'lighter',        label: '🥗 Prefiro algo mais leve' },
  { id: 'different',      label: '✨ Quero variar, só isso' },
  { id: 'allergy',        label: '⚠️ Tenho intolerância a um ingrediente' },
]

const WORKOUT_REASONS = [
  { id: 'no_gym',         label: '🏠 Não tenho academia hoje' },
  { id: 'muscle_pain',    label: '😣 Estou com dor muscular' },
  { id: 'shorter',        label: '⏱️ Quero algo mais curto' },
  { id: 'more_intense',   label: '🔥 Quero aumentar a intensidade' },
  { id: 'home_workout',   label: '💪 Treino em casa sem equipamento' },
]

interface Props {
  visible:  boolean
  type:     'meal' | 'workout'
  title:    string
  loading:  boolean
  onClose:  () => void
  onSwap:   (reason: string) => void
}

export default function SwapItemModal({ visible, type, title, loading, onClose, onSwap }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [custom,   setCustom]   = useState('')

  const reasons = type === 'meal' ? MEAL_REASONS : WORKOUT_REASONS

  const handleSwap = () => {
    const reason = custom.trim() || reasons.find(r => r.id === selected)?.label || ''
    if (!reason) return
    onSwap(reason)
  }

  const canSwap = (selected !== null || custom.trim().length > 0) && !loading

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />

        <Text style={s.title}>↺ {title}</Text>
        <Text style={s.sub}>Por qual motivo você quer trocar?</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={s.scroll}>
          {reasons.map(r => (
            <TouchableOpacity
              key={r.id}
              style={[s.option, selected === r.id && s.optionSel]}
              onPress={() => { setSelected(r.id); setCustom('') }}
              activeOpacity={0.75}
            >
              <View style={[s.radio, selected === r.id && s.radioSel]}>
                {selected === r.id && <View style={s.radioDot} />}
              </View>
              <Text style={[s.optionText, selected === r.id && s.optionTextSel]}>{r.label}</Text>
            </TouchableOpacity>
          ))}

          <View style={s.divider} />
          <Text style={s.orLabel}>Ou descreva o motivo:</Text>
          <TextInput
            style={[s.input, custom.length > 0 && s.inputActive]}
            value={custom}
            onChangeText={t => { setCustom(t); if (t.trim()) setSelected(null) }}
            placeholder="Ex: Não tenho ovos em casa hoje..."
            placeholderTextColor={Colors.text3}
            multiline
            maxLength={200}
          />
        </ScrollView>

        <View style={s.footer}>
          <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={loading}>
            <Text style={s.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.swapBtn, !canSwap && s.swapBtnDisabled]}
            onPress={handleSwap}
            disabled={!canSwap}
          >
            {loading
              ? <ActivityIndicator color={Colors.bg} size="small" />
              : <Text style={s.swapText}>✨ Trocar com IA</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:           { backgroundColor: Colors.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing[5], paddingTop: 12, maxHeight: '85%' },
  handle:          { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border2, alignSelf: 'center', marginBottom: 16 },
  title:           { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  sub:             { fontSize: 13, color: Colors.text2, marginBottom: 16 },
  scroll:          { maxHeight: 380 },
  option:          { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, marginBottom: 8, backgroundColor: Colors.bg3 },
  optionSel:       { borderColor: Colors.accent, backgroundColor: '#111800' },
  radio:           { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.border2, alignItems: 'center', justifyContent: 'center' },
  radioSel:        { borderColor: Colors.accent },
  radioDot:        { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accent },
  optionText:      { fontSize: 14, color: Colors.text2, flex: 1 },
  optionTextSel:   { color: Colors.text, fontWeight: '600' },
  divider:         { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  orLabel:         { fontSize: 12, color: Colors.text3, marginBottom: 8 },
  input:           { backgroundColor: Colors.bg3, borderRadius: Radius.md, padding: 13, fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.border2, minHeight: 70, textAlignVertical: 'top' },
  inputActive:     { borderColor: Colors.accent },
  footer:          { flexDirection: 'row', gap: 10, marginTop: 16, paddingBottom: 8 },
  cancelBtn:       { flex: 1, padding: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border2, alignItems: 'center' },
  cancelText:      { fontSize: 14, fontWeight: '600', color: Colors.text2 },
  swapBtn:         { flex: 2, padding: 14, borderRadius: Radius.md, backgroundColor: Colors.accent, alignItems: 'center' },
  swapBtnDisabled: { opacity: 0.4 },
  swapText:        { fontSize: 14, fontWeight: '700', color: Colors.bg },
})
