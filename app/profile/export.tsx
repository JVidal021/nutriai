import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@constants/index'
import { supabase } from '@services/supabase'
import { useUserStore } from '@store/index'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useT } from '@/i18n/useT'

export default function ExportScreen() {
  const insets = useSafeAreaInsets()
  const { t } = useT()
  const { user } = useUserStore()
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error

      const summary = [
        `${t('data_export.alert_name' as any)}: ${data.name}`,
        `${t('data_export.alert_email' as any)}: ${data.email}`,
        `${t('data_export.alert_weight' as any)}: ${data.weight} kg`,
        `${t('data_export.alert_height' as any)}: ${data.height} cm`,
        `${t('data_export.alert_age' as any)}: ${data.age} ${t('data_export.alert_age_unit' as any)}`,
        `${t('data_export.alert_goal' as any)}: ${data.goal}`,
        `${t('data_export.alert_created' as any)}: ${new Date(data.created_at).toLocaleDateString(undefined)}`,
      ].join('\n')

      Alert.alert(
        t('data_export.alert_title' as any),
        `${summary}\n\n${t('data_export.alert_footer' as any)}`,
        [{ text: 'OK' }]
      )
    } catch {
      Alert.alert(t('common.error' as any), t('data_export.error' as any))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}>
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backText}>← {t('common.back' as any)}</Text>
      </TouchableOpacity>

      <Text style={s.title}>{t('data_export.title' as any)}</Text>
      <Text style={s.sub}>{t('data_export.sub' as any)}</Text>

      <View style={s.card}>
        <Text style={s.cardTitle}>{t('data_export.included_title' as any)}</Text>
        {[
          'data_export.item_profile',
          'data_export.item_weight',
          'data_export.item_meals',
          'data_export.item_workouts',
          'data_export.item_xp',
          'data_export.item_prefs',
        ].map(key => (
          <Text key={key} style={s.item}>{t(key as any)}</Text>
        ))}
      </View>

      <TouchableOpacity
        style={[s.btn, loading && { opacity: 0.6 }]}
        onPress={handleExport}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color={Colors.bg} />
          : <Text style={s.btnText}>{t('data_export.view_btn' as any)}</Text>
        }
      </TouchableOpacity>

      <View style={s.infoCard}>
        <Text style={s.infoTitle}>{t('data_export.full_title' as any)}</Text>
        <Text style={s.infoText}>{t('data_export.full_text' as any)}</Text>
        <Text style={s.email}>suporte.nutriai@outlook.com</Text>
        <Text style={s.infoText}>{t('data_export.full_deadline' as any)}</Text>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.bg },
  content:   { padding: Spacing[5], paddingBottom: 48 },
  backBtn:   { marginBottom: 16 },
  backText:  { fontSize: 14, color: Colors.text2 },
  title:     { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  sub:       { fontSize: 13, color: Colors.text2, lineHeight: 18, marginBottom: 20 },
  card:      { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 10 },
  item:      { fontSize: 13, color: Colors.text2, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.border },
  btn:       { backgroundColor: Colors.accent, borderRadius: Radius.md, padding: 14, alignItems: 'center', marginBottom: 16 },
  btnText:   { fontSize: 14, fontWeight: '700', color: Colors.bg },
  infoCard:  { backgroundColor: Colors.bg3, borderRadius: Radius.lg, padding: 14 },
  infoTitle: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  infoText:  { fontSize: 12, color: Colors.text2, lineHeight: 18, marginBottom: 4 },
  email:     { fontSize: 13, fontWeight: '700', color: Colors.accent, marginVertical: 6 },
})
