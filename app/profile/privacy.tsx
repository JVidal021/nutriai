import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Switch, Alert, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@constants/index'
import { supabase } from '@services/supabase'
import { useUserStore } from '@store/index'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface Consents {
  health_data:     boolean
  meal_photos:     boolean
  push_notifications: boolean
  analytics:       boolean
}

const DEFAULT_CONSENTS: Consents = {
  health_data:        true,
  meal_photos:        true,
  push_notifications: true,
  analytics:          false,
}

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useUserStore()
  const [consents, setConsents]   = useState<Consents>(DEFAULT_CONSENTS)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!user) return
      try {
        const { data } = await supabase
          .from('consents')
          .select('consents')
          .eq('user_id', user.id)
          .maybeSingle()
        if (data?.consents) setConsents({ ...DEFAULT_CONSENTS, ...data.consents })
      } catch {}
      finally { setLoading(false) }
    }
    load()
  }, [user?.id])

  const toggle = (key: keyof Consents) => {
    if (key === 'health_data' || key === 'meal_photos') {
      Alert.alert(
        'Consentimento obrigatório',
        'Este dado é necessário para o funcionamento do app. Para revogar, exclua sua conta.',
        [{ text: 'Entendi' }]
      )
      return
    }
    setConsents(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      await supabase.from('consents').upsert({
        user_id:  user.id,
        consents,
        version:  '1.0',
        updated_at: new Date().toISOString(),
      })
      Alert.alert('✅ Preferências salvas', 'Seus consentimentos foram atualizados.')
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const ITEMS: Array<{ key: keyof Consents; title: string; desc: string; required: boolean }> = [
    { key: 'health_data',        required: true,  title: 'Dados de saúde e nutrição',    desc: 'Peso, altura, calorias e histórico alimentar para gerar seu plano personalizado.' },
    { key: 'meal_photos',        required: true,  title: 'Fotos das refeições',           desc: 'Imagens enviadas para análise de calorias pela IA. Não compartilhadas com terceiros.' },
    { key: 'push_notifications', required: false, title: 'Notificações push',             desc: 'Lembretes de refeições, treinos e streak. Você pode desativar nas configurações do celular.' },
    { key: 'analytics',          required: false, title: 'Análise de uso (analytics)',    desc: 'Dados anônimos de navegação para melhorarmos o app. Nenhum dado pessoal é incluído.' },
  ]

  if (loading) return (
    <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color={Colors.accent} />
    </View>
  )

  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]}>
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backText}>← Voltar</Text>
      </TouchableOpacity>

      <Text style={s.title}>🔒 Gerenciar consentimentos</Text>
      <Text style={s.sub}>Controle quais dados você autoriza o NutriAI a coletar e processar, conforme a LGPD.</Text>

      {ITEMS.map(item => (
        <View key={item.key} style={s.row}>
          <View style={s.rowLeft}>
            <View style={s.rowHeader}>
              <Text style={s.rowTitle}>{item.title}</Text>
              {item.required && (
                <View style={s.requiredBadge}><Text style={s.requiredText}>Obrigatório</Text></View>
              )}
            </View>
            <Text style={s.rowDesc}>{item.desc}</Text>
          </View>
          <Switch
            value={consents[item.key]}
            onValueChange={() => toggle(item.key)}
            trackColor={{ false: Colors.border2, true: Colors.accent }}
            thumbColor="#fff"
          />
        </View>
      ))}

      <TouchableOpacity
        style={[s.btn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color={Colors.bg} />
          : <Text style={s.btnText}>Salvar preferências</Text>
        }
      </TouchableOpacity>

      <Text style={s.legal}>
        Dúvidas sobre privacidade: suporte.nutriai@outlook.com{'\n'}
        Respondemos em até 15 dias úteis (LGPD Art. 18).
      </Text>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: Colors.bg },
  content:       { padding: Spacing[5], paddingBottom: 48 },
  backBtn:       { marginBottom: 16 },
  backText:      { fontSize: 14, color: Colors.text2 },
  title:         { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  sub:           { fontSize: 13, color: Colors.text2, lineHeight: 18, marginBottom: 20 },
  row:           { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  rowLeft:       { flex: 1 },
  rowHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  rowTitle:      { fontSize: 13, fontWeight: '600', color: Colors.text },
  requiredBadge: { backgroundColor: Colors.accent + '20', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  requiredText:  { fontSize: 10, fontWeight: '600', color: Colors.accent },
  rowDesc:       { fontSize: 12, color: Colors.text2, lineHeight: 16 },
  btn:           { backgroundColor: Colors.accent, borderRadius: Radius.md, padding: 14, alignItems: 'center', marginTop: 8, marginBottom: 16 },
  btnText:       { fontSize: 14, fontWeight: '700', color: Colors.bg },
  legal:         { fontSize: 11, color: Colors.text3, textAlign: 'center', lineHeight: 17 },
})
