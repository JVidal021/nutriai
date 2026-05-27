import React from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@constants/index'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const SUPPORT_EMAIL = 'suporte.nutriai@outlook.com'

export default function LGPDScreen() {
  const insets = useSafeAreaInsets()
  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: 60 }]}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
        <Text style={s.closeTxt}>✕ Fechar</Text>
      </TouchableOpacity>

      <Text style={s.title}>Aviso de Privacidade</Text>
      <Text style={s.subtitle}>Seus direitos sob a Lei Geral de Proteção de Dados (LGPD)</Text>

      {/* Banner de destaque */}
      <View style={s.heroBanner}>
        <Text style={s.heroEmoji}>🔒</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.heroTitle}>Seus dados são seus</Text>
          <Text style={s.heroSub}>
            O NutriAI trata seus dados com responsabilidade, transparência e em conformidade com a Lei 13.709/2018 (LGPD).
          </Text>
        </View>
      </View>

      {/* Dados coletados — visual */}
      <Text style={s.sectionHeader}>📋 O que coletamos</Text>
      {[
        { icon: '👤', label: 'Nome e e-mail',       desc: 'Para criar e identificar sua conta' },
        { icon: '⚖️', label: 'Peso, altura e idade', desc: 'Para calcular seu plano nutricional' },
        { icon: '🍽️', label: 'Fotos de refeições',  desc: 'Analisadas e descartadas imediatamente' },
        { icon: '💪', label: 'Dados de treino',      desc: 'Para gerar planos e acompanhar progresso' },
        { icon: '😊', label: 'Check-in emocional',   desc: 'Para adaptar planos ao seu humor' },
        { icon: '💳', label: 'Dados de pagamento',   desc: 'Gerenciados diretamente pelo Mercado Pago' },
      ].map(item => (
        <View key={item.label} style={s.dataRow}>
          <Text style={s.dataIcon}>{item.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.dataLabel}>{item.label}</Text>
            <Text style={s.dataDesc}>{item.desc}</Text>
          </View>
        </View>
      ))}

      {/* Seus direitos */}
      <Text style={s.sectionHeader}>⚖️ Seus direitos</Text>
      <View style={s.card}>
        {[
          { right: 'Acesso',           desc: 'Solicitar cópia de todos os seus dados' },
          { right: 'Correção',         desc: 'Corrigir dados incorretos nas configurações' },
          { right: 'Exclusão',         desc: 'Apagar sua conta e todos os dados em Perfil → Excluir conta' },
          { right: 'Portabilidade',    desc: 'Receber seus dados em formato estruturado' },
          { right: 'Revogação',        desc: 'Cancelar o consentimento a qualquer momento' },
          { right: 'Oposição',         desc: 'Contestar tratamentos com os quais não concorda' },
          { right: 'Reclamação ANPD',  desc: 'Registrar queixa na autoridade nacional em www.gov.br/anpd' },
        ].map(item => (
          <View key={item.right} style={s.rightRow}>
            <View style={s.rightDot} />
            <View style={{ flex: 1 }}>
              <Text style={s.rightLabel}>{item.right}</Text>
              <Text style={s.rightDesc}>{item.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Com quem compartilhamos */}
      <Text style={s.sectionHeader}>🤝 Compartilhamento</Text>
      <View style={s.card}>
        {[
          { name: 'Supabase (EUA)',        purpose: 'Banco de dados e autenticação segura' },
          { name: 'Groq / Meta AI (EUA)',  purpose: 'Geração de planos por IA (sem dados pessoais diretos)' },
          { name: 'Mercado Pago',          purpose: 'Processamento de pagamentos' },
          { name: 'ExerciseDB / RapidAPI', purpose: 'Busca de demonstrações de exercícios' },
        ].map(item => (
          <View key={item.name} style={s.shareRow}>
            <Text style={s.shareName}>{item.name}</Text>
            <Text style={s.sharePurpose}>{item.purpose}</Text>
          </View>
        ))}
        <Text style={s.noSellNote}>🚫 Não vendemos nem alugamos seus dados a terceiros.</Text>
      </View>

      {/* Consentimento */}
      <Text style={s.sectionHeader}>✅ Seu consentimento</Text>
      <View style={s.card}>
        <Text style={s.bodyText}>
          Ao criar sua conta, você consentiu com o tratamento dos dados acima para as finalidades descritas. Você pode revogar esse consentimento a qualquer momento, o que resultará no encerramento da sua conta.
          {'\n\n'}Dados de saúde (peso, altura, restrições alimentares) são considerados dados sensíveis pela LGPD. Seu uso é estritamente limitado à personalização do serviço.
        </Text>
      </View>

      {/* Retenção */}
      <Text style={s.sectionHeader}>⏱️ Por quanto tempo</Text>
      <View style={s.card}>
        <Text style={s.bodyText}>
          • Dados da conta: até você excluí-la{'\n'}
          • Após exclusão: removidos em até 30 dias{'\n'}
          • Fotos de refeições: descartadas após a análise{'\n'}
          • Dados financeiros: 5 anos (obrigação legal)
        </Text>
      </View>

      {/* Contato */}
      <View style={s.contactCard}>
        <Text style={s.contactTitle}>📬 Fale com nosso Encarregado de Dados</Text>
        <Text style={s.contactBody}>
          Para exercer qualquer direito ou tirar dúvidas sobre o tratamento dos seus dados:
        </Text>
        <TouchableOpacity onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=LGPD - Direitos do Titular`)}>
          <Text style={s.contactEmail}>{SUPPORT_EMAIL}</Text>
        </TouchableOpacity>
        <Text style={s.contactSla}>Prazo de resposta: até 15 dias úteis</Text>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: Colors.bg },
  content:       { paddingHorizontal: Spacing[5] },
  closeBtn:      { alignSelf: 'flex-end', backgroundColor: Colors.bg3, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  closeTxt:      { fontSize: 13, fontWeight: '600', color: Colors.text2 },
  title:         { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  subtitle:      { fontSize: 13, color: Colors.text2, marginBottom: 16, lineHeight: 18 },

  heroBanner:    { flexDirection: 'row', gap: 12, backgroundColor: Colors.accent + '12', borderRadius: 16, padding: 14, marginBottom: 20, alignItems: 'flex-start', borderWidth: 1, borderColor: Colors.accent + '30' },
  heroEmoji:     { fontSize: 28 },
  heroTitle:     { fontSize: 14, fontWeight: '800', color: Colors.accent, marginBottom: 3 },
  heroSub:       { fontSize: 12, color: Colors.text2, lineHeight: 17 },

  sectionHeader: { fontSize: 13, fontWeight: '800', color: Colors.text, marginBottom: 8, marginTop: 4 },

  dataRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Colors.bg2, borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: Colors.border },
  dataIcon:      { fontSize: 20, width: 28, textAlign: 'center' },
  dataLabel:     { fontSize: 13, fontWeight: '600', color: Colors.text },
  dataDesc:      { fontSize: 12, color: Colors.text2, marginTop: 1 },

  card:          { backgroundColor: Colors.bg2, borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  bodyText:      { fontSize: 13, color: Colors.text2, lineHeight: 20 },

  rightRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  rightDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent, marginTop: 5, flexShrink: 0 },
  rightLabel:    { fontSize: 13, fontWeight: '700', color: Colors.text },
  rightDesc:     { fontSize: 12, color: Colors.text2, marginTop: 1 },

  shareRow:      { marginBottom: 10 },
  shareName:     { fontSize: 13, fontWeight: '700', color: Colors.text },
  sharePurpose:  { fontSize: 12, color: Colors.text2, marginTop: 1 },
  noSellNote:    { fontSize: 12, color: Colors.teal, marginTop: 8, fontWeight: '600' },

  contactCard:   { backgroundColor: Colors.bg2, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.accent + '40', alignItems: 'center', gap: 6 },
  contactTitle:  { fontSize: 14, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  contactBody:   { fontSize: 13, color: Colors.text2, textAlign: 'center', lineHeight: 18 },
  contactEmail:  { fontSize: 14, fontWeight: '700', color: Colors.accent, textDecorationLine: 'underline' },
  contactSla:    { fontSize: 11, color: Colors.text3 },
})
