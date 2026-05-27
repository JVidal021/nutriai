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

export default function ExportScreen() {
  const insets = useSafeAreaInsets()
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

      // Resumo dos dados para exibição
      const summary = [
        `Nome: ${data.name}`,
        `E-mail: ${data.email}`,
        `Peso: ${data.weight} kg`,
        `Altura: ${data.height} cm`,
        `Idade: ${data.age} anos`,
        `Objetivo: ${data.goal}`,
        `Conta criada em: ${new Date(data.created_at).toLocaleDateString('pt-BR')}`,
      ].join('\n')

      Alert.alert(
        '📄 Seus dados',
        `${summary}\n\nPara uma exportação completa (refeições, treinos, histórico), entre em contato: suporte.nutriai@outlook.com`,
        [{ text: 'OK' }]
      )
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar seus dados. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]}>
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backText}>← Voltar</Text>
      </TouchableOpacity>

      <Text style={s.title}>📄 Exportar meus dados</Text>
      <Text style={s.sub}>Você tem direito de receber uma cópia de todos os dados que armazenamos sobre você (LGPD Art. 18).</Text>

      <View style={s.card}>
        <Text style={s.cardTitle}>O que está incluído</Text>
        {[
          '👤 Perfil e dados pessoais',
          '📊 Histórico de peso e checkins',
          '🍽️ Refeições e calorias registradas',
          '💪 Histórico de treinos',
          '🏆 XP, ranks e conquistas',
          '⚙️ Preferências e configurações',
        ].map(item => (
          <Text key={item} style={s.item}>{item}</Text>
        ))}
      </View>

      <TouchableOpacity
        style={[s.btn, loading && { opacity: 0.6 }]}
        onPress={handleExport}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color={Colors.bg} />
          : <Text style={s.btnText}>📥 Ver meus dados</Text>
        }
      </TouchableOpacity>

      <View style={s.infoCard}>
        <Text style={s.infoTitle}>Exportação completa</Text>
        <Text style={s.infoText}>
          Para receber um arquivo JSON completo com todo o seu histórico, envie um e-mail para:
        </Text>
        <Text style={s.email}>suporte.nutriai@outlook.com</Text>
        <Text style={s.infoText}>Responderemos em até 15 dias úteis, conforme a LGPD.</Text>
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
