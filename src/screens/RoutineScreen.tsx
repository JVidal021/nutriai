import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius } from '@constants/index'
import { useProgressStore, useUserStore } from '@store/index'
import { calcTMB, calcTDEE, calcTargetCalories } from '@utils/index'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useT } from '@/i18n/useT'

export default function RoutineScreen() {
  const insets  = useSafeAreaInsets()
  const { t } = useT()
  const { user } = useUserStore()
  const { getTodayCheckin } = useProgressStore()
  const checkin = getTodayCheckin()
  const isTired = checkin?.mood === 'tired' || checkin?.mood === 'exhausted'

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
      titleKey: 'routine.block_warmup_title',
      subKey:   'routine.block_warmup_sub',
      statusKey:'routine.block_warmup_status',
      statusColor: Colors.teal,
      statusBg: Colors.teal + '18',
      adapted: false,
    },
    {
      emoji: isTired ? '🧘' : '💪',
      titleKey: isTired ? 'routine.block_tired_title'  : 'routine.block_main_title',
      subKey:   isTired ? 'routine.block_tired_sub'    : 'routine.block_main_sub',
      statusKey:isTired ? 'routine.block_tired_status' : 'routine.block_main_status',
      statusColor: isTired ? Colors.accent : Colors.purple,
      statusBg: isTired ? Colors.accent + '18' : Colors.purple + '18',
      adapted: isTired,
    },
    {
      emoji: isTired ? '🚶' : '🏃',
      titleKey: isTired ? 'routine.block_tired_cardio_title' : 'routine.block_cardio_title',
      subKey:   isTired ? 'routine.block_tired_cardio_sub'   : 'routine.block_cardio_sub',
      statusKey:'routine.block_cardio_status',
      statusColor: Colors.orange,
      statusBg: Colors.orange + '18',
      adapted: false,
    },
    {
      emoji: '❄️',
      titleKey: 'routine.block_cooldown_title',
      subKey:   'routine.block_cooldown_sub',
      statusKey:'routine.block_cooldown_status',
      statusColor: Colors.teal,
      statusBg: Colors.teal + '18',
      adapted: false,
    },
  ]

  const RULES = [
    { emoji: '😔', titleKey: 'routine.rule1_title', descKey: 'routine.rule1_desc' },
    { emoji: '📅', titleKey: 'routine.rule2_title', descKey: 'routine.rule2_desc' },
    { emoji: '🔥', titleKey: 'routine.rule3_title', descKey: 'routine.rule3_desc' },
  ]

  const handleStart = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    Alert.alert(t('routine.started_title' as any), t('routine.started_msg' as any))
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>{t('routine.title' as any)}</Text>
      <Text style={s.sub}>{t('routine.sub' as any)}</Text>

      {isTired && checkin?.adaptations && (
        <View style={s.adaptBanner}>
          <Text style={s.adaptText}>
            🧠 {checkin.moodEmoji} {checkin.adaptations.message}
          </Text>
        </View>
      )}

      <View style={s.card}>
        <Text style={s.cardTitle}>{t('routine.ai_care_title' as any)}</Text>
        {RULES.map(rule => (
          <View key={rule.titleKey} style={s.ruleRow}>
            <Text style={s.ruleEmoji}>{rule.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.ruleTitle}>{t(rule.titleKey as any)}</Text>
              <Text style={s.ruleDesc}>{t(rule.descKey as any)}</Text>
            </View>
          </View>
        ))}
      </View>

      {isTired && checkin?.adaptations && (
        <View style={s.card}>
          <Text style={s.cardTitle}>{t('routine.cal_adjust_title' as any)}</Text>
          <View style={s.adjustRow}>
            <Text style={s.adjustLabel}>{t('routine.cal_original' as any)}</Text>
            <Text style={[s.adjustVal, { textDecorationLine: 'line-through', color: Colors.text3 }]}>
              {baseCalories.toLocaleString()} kcal
            </Text>
          </View>
          <View style={s.adjustRow}>
            <Text style={s.adjustLabel}>{t('routine.cal_adjust' as any)}</Text>
            <Text style={[s.adjustVal, { color: Colors.orange }]}>{checkin.adaptations.caloriesAdjusted} kcal</Text>
          </View>
          <View style={[s.adjustRow, { borderBottomWidth: 0 }]}>
            <Text style={[s.adjustLabel, { fontWeight: '700', color: Colors.text }]}>{t('routine.cal_new' as any)}</Text>
            <Text style={[s.adjustVal, { color: Colors.accent, fontSize: 18 }]}>
              {(baseCalories + (checkin.adaptations.caloriesAdjusted ?? 0)).toLocaleString()} kcal
            </Text>
          </View>
        </View>
      )}

      <Text style={[s.cardTitle, { marginBottom: 8 }]}>{t('routine.blocks_today' as any)}</Text>
      {blocks.map((block, i) => (
        <View key={i} style={[s.blockCard, block.adapted && s.blockAdapted]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <Text style={{ fontSize: 22 }}>{block.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.blockTitle}>{t(block.titleKey as any)}</Text>
              <Text style={s.blockSub}>{t(block.subKey as any)}</Text>
              {block.adapted && (
                <Text style={s.blockOriginal}>{t('routine.block_original_text' as any)}</Text>
              )}
            </View>
            <View style={[s.blockBadge, { backgroundColor: block.statusBg }]}>
              <Text style={[s.blockBadgeText, { color: block.statusColor }]}>{t(block.statusKey as any)}</Text>
            </View>
          </View>
        </View>
      ))}

      <TouchableOpacity style={s.startBtn} onPress={handleStart}>
        <Text style={s.startBtnText}>{t('routine.start_btn' as any)}</Text>
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
