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

export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets()
  const [confirmation, setConfirmation] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { user, isLoading: isAuthLoading, clearUser } = useUserStore()

  if (isAuthLoading || !user) return null

  const CONFIRM_PHRASE = 'EXCLUIR MINHA CONTA'
  const isConfirmed = confirmation.trim() === CONFIRM_PHRASE

  const handleDelete = async () => {
    if (!isConfirmed || !user) return

    Alert.alert(
      'Última confirmação',
      'Todos os seus dados serão excluídos permanentemente. Esta ação é irreversível.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir definitivamente',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true)
            try {
              // Edge Function com service_role exclui o usuário de auth.users
              // (CASCADE remove public.users e todas as tabelas dependentes)
              const { error } = await supabase.functions.invoke('delete-user')
              if (error) throw new Error(error.message ?? 'Erro ao excluir conta')

              // Deslogar localmente (sessão já foi invalidada no servidor)
              await supabase.auth.signOut()
              clearUser()

              Alert.alert(
                'Conta excluída',
                'Todos os seus dados foram removidos permanentemente. Obrigado por usar o NutriAI.',
                [{ text: 'OK', onPress: () => router.replace('/onboarding') }]
              )
            } catch (err) {
              Alert.alert(
                'Erro',
                err instanceof Error ? err.message : 'Não foi possível excluir a conta. Tente novamente ou entre em contato: suporte.nutriai@outlook.com'
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
        <Text style={s.title}>Excluir conta</Text>
        <Text style={s.sub}>Esta ação é permanente e não pode ser desfeita.</Text>
      </View>

      {/* O que será excluído */}
      <View style={s.card}>
        <Text style={s.cardTitle}>O que será excluído permanentemente:</Text>
        {[
          '📊 Todo o seu histórico alimentar',
          '💪 Histórico de treinos e progresso',
          '🏆 Seus ranks, XP e conquistas',
          '🤝 Vínculos de Co-op',
          '⚙️ Preferências e configurações',
          '📸 Fotos de refeições armazenadas',
          '👤 Seu perfil e dados pessoais',
        ].map(item => (
          <View key={item} style={s.deleteItem}>
            <Text style={s.deleteItemText}>{item}</Text>
          </View>
        ))}
      </View>

      {/* Alternativas */}
      <View style={s.altCard}>
        <Text style={s.altTitle}>Antes de excluir, considere:</Text>
        <TouchableOpacity style={s.altRow} onPress={() => router.push('/profile/export')}>
          <Text style={s.altText}>📄 Exportar seus dados primeiro</Text>
          <Text style={s.altArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.altRow} onPress={() => router.push('/subscription')}>
          <Text style={s.altText}>⏸️ Pausar a assinatura sem excluir</Text>
          <Text style={s.altArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.altRow} onPress={() => router.push('/profile/privacy')}>
          <Text style={s.altText}>🔒 Gerenciar consentimentos</Text>
          <Text style={s.altArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Campo de confirmação */}
      <View style={s.confirmCard}>
        <Text style={s.confirmLabel}>
          Para confirmar, digite exatamente:
        </Text>
        <Text style={s.confirmPhrase}>{CONFIRM_PHRASE}</Text>
        <TextInput
          style={[s.input, isConfirmed && s.inputConfirmed]}
          value={confirmation}
          onChangeText={setConfirmation}
          placeholder="Digite aqui para confirmar"
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
          {isLoading ? 'Excluindo...' : '🗑️ Excluir minha conta definitivamente'}
        </Text>
      </TouchableOpacity>

      <Text style={s.contact}>
        Dúvidas sobre seus dados?{'\n'}
        suporte.nutriai@outlook.com
      </Text>
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
