import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@constants/index'
import { supabase } from '@services/supabase'
import { useUserStore } from '@store/index'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useT } from '@/i18n/useT'

export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets()
  const { t } = useT()
  const [confirmation, setConfirmation] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { user, isLoading: isAuthLoading, clearUser } = useUserStore()

  if (isAuthLoading || !user) return null

  const CONFIRM_PHRASE = t('delete_account.confirm_phrase' as any)
  const isConfirmed = confirmation.trim() === CONFIRM_PHRASE

  const DELETE_ITEMS = [
    'delete_account.item_1',
    'delete_account.item_2',
    'delete_account.item_3',
    'delete_account.item_4',
    'delete_account.item_5',
    'delete_account.item_6',
    'delete_account.item_7',
  ]

  const handleDelete = async () => {
    if (!isConfirmed || !user) return

    Alert.alert(
      t('delete_account.last_confirm_title' as any),
      t('delete_account.last_confirm_msg' as any),
      [
        { text: t('common.cancel' as any), style: 'cancel' },
        {
          text: t('delete_account.delete_final' as any),
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true)
            try {
              const { error } = await supabase.functions.invoke('delete-user')
              if (error) throw new Error(error.message ?? t('delete_account.error_delete' as any))

              await supabase.auth.signOut()
              clearUser()

              Alert.alert(
                t('delete_account.deleted_title' as any),
                t('delete_account.deleted_msg' as any),
                [{ text: 'OK', onPress: () => router.replace('/onboarding') }]
              )
            } catch (err) {
              Alert.alert(
                t('common.error' as any),
                err instanceof Error ? err.message : t('delete_account.error_delete' as any)
              )
            } finally {
              setIsLoading(false)
            }
          },
        },
      ]
    )
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]}>
      <View style={s.header}>
        <Text style={s.emoji}>⚠️</Text>
        <Text style={s.title}>{t('delete_account.title' as any)}</Text>
        <Text style={s.sub}>{t('delete_account.sub' as any)}</Text>
      </View>

      {/* What will be deleted */}
      <View style={s.card}>
        <Text style={s.cardTitle}>{t('delete_account.what_deleted_title' as any)}</Text>
        {DELETE_ITEMS.map(key => (
          <View key={key} style={s.deleteItem}>
            <Text style={s.deleteItemText}>{t(key as any)}</Text>
          </View>
        ))}
      </View>

      {/* Alternatives */}
      <View style={s.altCard}>
        <Text style={s.altTitle}>{t('delete_account.alt_title' as any)}</Text>
        <TouchableOpacity style={s.altRow} onPress={() => router.push('/profile/export')}>
          <Text style={s.altText}>{t('delete_account.alt_export' as any)}</Text>
          <Text style={s.altArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.altRow} onPress={() => router.push('/(tabs)/subscription')}>
          <Text style={s.altText}>{t('delete_account.alt_pause' as any)}</Text>
          <Text style={s.altArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.altRow} onPress={() => router.push('/profile/privacy')}>
          <Text style={s.altText}>{t('delete_account.alt_privacy' as any)}</Text>
          <Text style={s.altArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Confirmation field */}
      <View style={s.confirmCard}>
        <Text style={s.confirmLabel}>{t('delete_account.confirm_label' as any)}</Text>
        <Text style={s.confirmPhrase}>{CONFIRM_PHRASE}</Text>
        <TextInput
          style={[s.input, isConfirmed && s.inputConfirmed]}
          value={confirmation}
          onChangeText={setConfirmation}
          placeholder={t('delete_account.confirm_placeholder' as any)}
          placeholderTextColor={Colors.text3}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </View>

      <TouchableOpacity
        style={[s.btnDelete, (!isConfirmed || isLoading) && s.btnDisabled]}
        onPress={handleDelete}
        disabled={!isConfirmed || isLoading}
      >
        <Text style={s.btnDeleteText}>
          {isLoading ? t('delete_account.deleting' as any) : t('delete_account.delete_btn' as any)}
        </Text>
      </TouchableOpacity>

      <Text style={s.contact}>{t('delete_account.contact' as any)}</Text>
    </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root:            { flex: 1, backgroundColor: Colors.bg },
  content:         { padding: Spacing[5], paddingBottom: 48 },
  header:          { alignItems: 'center', marginBottom: 20 },
  emoji:           { fontSize: 48, marginBottom: 10 },
  title:           { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  sub:             { fontSize: 14, color: Colors.text2, textAlign: 'center' },
  card:            { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  cardTitle:       { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 10 },
  deleteItem:      { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  deleteItemText:  { fontSize: 13, color: Colors.text2 },
  altCard:         { backgroundColor: Colors.bg3, borderRadius: Radius.lg, padding: 14, marginBottom: 16 },
  altTitle:        { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 10 },
  altRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  altText:         { fontSize: 13, color: Colors.text },
  altArrow:        { fontSize: 14, color: Colors.text3 },
  confirmCard:     { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  confirmLabel:    { fontSize: 13, color: Colors.text2, marginBottom: 8 },
  confirmPhrase:   { fontSize: 14, fontWeight: '700', color: Colors.red, fontFamily: 'monospace', marginBottom: 12 },
  input:           { backgroundColor: Colors.bg3, borderRadius: Radius.md, padding: 13, fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.border2 },
  inputConfirmed:  { borderColor: Colors.red },
  btnDelete:       { backgroundColor: Colors.red, borderRadius: Radius.md, padding: 14, alignItems: 'center', marginBottom: 16 },
  btnDisabled:     { opacity: 0.4 },
  btnDeleteText:   { fontSize: 14, fontWeight: '700', color: '#fff' },
  contact:         { fontSize: 12, color: Colors.text3, textAlign: 'center', lineHeight: 18 },
})
