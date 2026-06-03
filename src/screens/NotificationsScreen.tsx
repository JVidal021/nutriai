import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@constants/index'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useT } from '@/i18n/useT'
import { useNotificationStore, type ReminderId } from '@store/notificationStore'
import { scheduleDailyReminders, requestNotificationPermission } from '@services/notifications'

const EMOJI: Record<ReminderId, string> = {
  breakfast: '☀️',
  lunch:     '📸',
  checkin:   '🌿',
  streak:    '🔥',
}

// Horários sugeridos para troca rápida (sem precisar de date picker nativo)
const HOUR_OPTIONS: Record<ReminderId, number[]> = {
  breakfast: [6, 7, 8, 9, 10],
  lunch:     [11, 12, 13, 14],
  checkin:   [17, 18, 19, 20],
  streak:    [20, 21, 22],
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets()
  const { t } = useT()
  const { enabled, reminders, setEnabled, toggleReminder, setReminderHour } = useNotificationStore()

  // Reagenda sempre que algo muda
  const sync = async () => {
    await scheduleDailyReminders()
  }

  const handleMaster = async (on: boolean) => {
    setEnabled(on)
    if (on) await requestNotificationPermission()
    await sync()
  }

  const handleToggle = async (id: ReminderId) => {
    toggleReminder(id)
    await sync()
  }

  const handleHour = async (id: ReminderId, hour: number) => {
    setReminderHour(id, hour)
    await sync()
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backText}>← {t('common.back' as any)}</Text>
      </TouchableOpacity>

      <Text style={s.title}>{t('reminders.screen_title' as any)}</Text>
      <Text style={s.sub}>{t('reminders.screen_sub' as any)}</Text>

      {/* Master switch */}
      <View style={s.masterCard}>
        <View style={{ flex: 1 }}>
          <Text style={s.masterLabel}>{t('reminders.master_label' as any)}</Text>
          <Text style={s.masterSub}>{t('reminders.master_sub' as any)}</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={handleMaster}
          trackColor={{ false: Colors.border2, true: Colors.accent }}
          thumbColor={Colors.bg}
        />
      </View>

      {/* Lista de lembretes */}
      <View style={[s.list, !enabled && { opacity: 0.4 }]} pointerEvents={enabled ? 'auto' : 'none'}>
        {reminders.map(r => (
          <View key={r.id} style={s.card}>
            <View style={s.cardTop}>
              <Text style={s.cardEmoji}>{EMOJI[r.id]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.cardName}>{t(`reminders.${r.id}_name` as any)}</Text>
                <Text style={s.cardBody}>{t(`reminders.${r.id}_body` as any)}</Text>
              </View>
              <Switch
                value={r.enabled}
                onValueChange={() => handleToggle(r.id)}
                trackColor={{ false: Colors.border2, true: Colors.accent }}
                thumbColor={Colors.bg}
              />
            </View>

            {/* Seletor de horário — só quando o lembrete está ligado */}
            {r.enabled && (
              <View style={s.hourRow}>
                <Text style={s.hourLabel}>{t('reminders.time_label' as any)}</Text>
                <View style={s.hourChips}>
                  {HOUR_OPTIONS[r.id].map(h => (
                    <TouchableOpacity
                      key={h}
                      style={[s.hourChip, r.hour === h && s.hourChipActive]}
                      onPress={() => handleHour(r.id, h)}
                    >
                      <Text style={[s.hourChipText, r.hour === h && s.hourChipTextActive]}>
                        {String(h).padStart(2, '0')}h
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        ))}
      </View>

      <Text style={s.note}>{t('reminders.permission_needed' as any)}</Text>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: Colors.bg },
  content:        { padding: Spacing[5], paddingBottom: 48 },
  backBtn:        { marginBottom: 16 },
  backText:       { fontSize: 14, color: Colors.text2, fontWeight: '500' },
  title:          { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  sub:            { fontSize: 13, color: Colors.text2, lineHeight: 18, marginBottom: 20 },
  masterCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  masterLabel:    { fontSize: 15, fontWeight: '700', color: Colors.text },
  masterSub:      { fontSize: 12, color: Colors.text2, marginTop: 2 },
  list:           { gap: 10 },
  card:           { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  cardTop:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardEmoji:      { fontSize: 24, width: 30, textAlign: 'center' },
  cardName:       { fontSize: 14, fontWeight: '700', color: Colors.text },
  cardBody:       { fontSize: 11, color: Colors.text2, marginTop: 2, lineHeight: 15 },
  hourRow:        { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  hourLabel:      { fontSize: 11, fontWeight: '600', color: Colors.text3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  hourChips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hourChip:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border2 },
  hourChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  hourChipText:   { fontSize: 12, fontWeight: '600', color: Colors.text2 },
  hourChipTextActive: { color: Colors.bg, fontWeight: '800' },
  note:           { fontSize: 11, color: Colors.text3, textAlign: 'center', lineHeight: 16, marginTop: 16 },
})
