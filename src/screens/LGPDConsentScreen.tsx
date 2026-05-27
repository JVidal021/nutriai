import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, Linking,
} from 'react-native'
import { Colors, Spacing, Radius } from '@constants/index'
import { supabase } from '@services/supabase'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface ConsentItem {
  id: string
  required: boolean
  title: string
  description: string
  lawRef: string
}

const CONSENT_ITEMS: ConsentItem[] = [
  {
    id: 'health_data',
    required: true,
    title: 'Dados de saúde e nutrição',
    description:
      'Coletamos peso, altura, histórico alimentar, rotinas de treino e humor para personalizar seu plano. Esses dados são classificados como sensíveis pela LGPD e usados exclusivamente para o funcionamento do app.',
    lawRef: 'LGPD Art. 11 — Dados Sensíveis',
  },
  {
    id: 'meal_photos',
    required: true,
    title: 'Fotos das refeições',
    description:
      'As fotos dos seus pratos são enviadas ao nosso servidor para análise nutricional por IA e excluídas após o processamento. Não compartilhamos suas imagens com terceiros.',
    lawRef: 'LGPD Art. 7 — Tratamento de dados',
  },
  {
    id: 'ai_processing',
    required: true,
    title: 'Processamento por inteligência artificial',
    description:
      'Seus dados são processados por sistemas de IA para gerar recomendações personalizadas. Nenhum dado pessoal identificável é enviado a modelos de IA externos — apenas informações anonimizadas de perfil.',
    lawRef: 'LGPD Art. 20 — Decisões automatizadas',
  },
  {
    id: 'data_retention',
    required: true,
    title: 'Retenção e exclusão de dados',
    description:
      'Seus dados ficam armazenados enquanto sua conta estiver ativa. Após 12 meses de inatividade, notificamos antes de excluir. Você pode solicitar a exclusão completa a qualquer momento em Perfil → Configurações → Excluir conta.',
    lawRef: 'LGPD Art. 18 — Direitos do titular',
  },
  {
    id: 'notifications',
    required: false,
    title: 'Notificações de lembretes (opcional)',
    description:
      'Enviamos lembretes para registrar refeições, completar treinos e acompanhar metas. Você pode desativar a qualquer momento nas configurações.',
    lawRef: 'Opcional',
  },
]

interface Props {
  onAccept: (consents: Record<string, boolean>) => void
  onDecline: () => void
}

export default function LGPDConsentScreen({ onAccept, onDecline }: Props) {
  const insets = useSafeAreaInsets()
  const [consents, setConsents] = useState<Record<string, boolean>>(
    Object.fromEntries(CONSENT_ITEMS.map(c => [c.id, c.required]))
  )
  const [isLoading, setIsLoading] = useState(false)

  const allRequiredAccepted = CONSENT_ITEMS
    .filter(c => c.required)
    .every(c => consents[c.id])

  const toggle = (id: string, required: boolean) => {
    if (required) return // obrigatórios não podem ser desmarcados
    setConsents(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleAccept = async () => {
    if (!allRequiredAccepted) {
      Alert.alert(
        'Consentimentos obrigatórios',
        'Para usar o NutriAI, é necessário aceitar os itens marcados como obrigatórios, pois são essenciais para o funcionamento do app.'
      )
      return
    }

    setIsLoading(true)
    try {
      // Registrar consentimento no banco com timestamp e versão
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('consents').upsert({
          user_id: user.id,
          consents,
          version: '1.0',  // incrementar quando a política mudar
          ip_hash: null,   // não coletamos IP — apenas o timestamp basta
          given_at: new Date().toISOString(),
        })
      }
      onAccept(consents)
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível registrar seu consentimento. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDecline = () => {
    Alert.alert(
      'Tem certeza?',
      'Sem aceitar os termos obrigatórios, não é possível usar o NutriAI, pois esses dados são essenciais para personalizar seu plano de saúde.',
      [
        { text: 'Voltar', style: 'cancel' },
        { text: 'Sair mesmo assim', style: 'destructive', onPress: onDecline },
      ]
    )
  }

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.logoMark}><Text style={s.logoLeaf}>🌿</Text></View>
        <View style={s.headerText}>
          <Text style={s.title}>Seus dados, seu controle</Text>
          <Text style={s.subtitle}>Antes de começar, precisa dar um ok para cada item abaixo.</Text>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Aviso LGPD destacado */}
        <View style={s.lgpdBanner}>
          <Text style={s.lgpdIcon}>🔒</Text>
          <View style={s.lgpdText}>
            <Text style={s.lgpdTitle}>Protegido pela LGPD</Text>
            <Text style={s.lgpdSub}>
              Seus dados de saúde são classificados como sensíveis pela Lei Geral de Proteção de Dados.
              Você tem direito de acessar, corrigir e excluir seus dados a qualquer momento.
            </Text>
          </View>
        </View>

        {/* Itens de consentimento */}
        {CONSENT_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[s.consentCard, consents[item.id] && s.consentCardOn]}
            onPress={() => toggle(item.id, item.required)}
            activeOpacity={item.required ? 1 : 0.7}
          >
            <View style={s.cardTop}>
              <View style={s.cardLeft}>
                <Text style={s.cardTitle}>{item.title}</Text>
                <View style={s.cardBadgeRow}>
                  <View style={[s.badge, item.required ? s.badgeRequired : s.badgeOptional]}>
                    <Text style={[s.badgeText, item.required ? s.badgeTextRequired : s.badgeTextOptional]}>
                      {item.required ? 'Obrigatório' : 'Opcional'}
                    </Text>
                  </View>
                  <Text style={s.lawRef}>{item.lawRef}</Text>
                </View>
              </View>
              <View style={[s.checkbox, consents[item.id] && s.checkboxOn]}>
                {consents[item.id] && (
                  <Text style={s.checkmark}>✓</Text>
                )}
              </View>
            </View>
            <Text style={s.cardDesc}>{item.description}</Text>
          </TouchableOpacity>
        ))}

        {/* Links legais */}
        <View style={s.legalLinks}>
          <TouchableOpacity onPress={() => Linking.openURL('https://nutriai.app/privacidade')}>
            <Text style={s.legalLink}>Política de Privacidade</Text>
          </TouchableOpacity>
          <Text style={s.legalSep}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://nutriai.app/termos')}>
            <Text style={s.legalLink}>Termos de Uso</Text>
          </TouchableOpacity>
        </View>

        {/* Nota sobre direitos */}
        <View style={s.rightsBox}>
          <Text style={s.rightsTitle}>Seus direitos (LGPD Art. 18)</Text>
          <Text style={s.rightsText}>
            • Acessar os dados que guardamos sobre você{'\n'}
            • Corrigir dados incorretos ou desatualizados{'\n'}
            • Excluir sua conta e todos os dados permanentemente{'\n'}
            • Revogar consentimentos opcionais a qualquer momento{'\n'}
            • Receber seus dados em formato legível (portabilidade)
          </Text>
          <Text style={s.rightsContact}>
            Dúvidas? Fale com nosso encarregado: suporte.nutriai@outlook.com
          </Text>
        </View>

      </ScrollView>

      {/* Footer com botões */}
      <View style={s.footer}>
        <Text style={s.footerHint}>
          {allRequiredAccepted
            ? '✓ Todos os itens obrigatórios aceitos'
            : `Aceite os ${CONSENT_ITEMS.filter(c => c.required && !consents[c.id]).length} itens obrigatórios para continuar`}
        </Text>
        <View style={s.btnRow}>
          <TouchableOpacity style={s.btnDecline} onPress={handleDecline}>
            <Text style={s.btnDeclineText}>Recusar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btnAccept, !allRequiredAccepted && s.btnAcceptDisabled]}
            onPress={handleAccept}
            disabled={isLoading}
          >
            <Text style={s.btnAcceptText}>
              {isLoading ? 'Salvando...' : 'Aceitar e continuar →'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root:              { flex: 1, backgroundColor: Colors.bg },
  header:            { flexDirection: 'row', gap: 12, padding: Spacing[5], alignItems: 'flex-start' },
  logoMark:          { width: 40, height: 40, borderRadius: 11, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  logoLeaf:          { fontSize: 20 },
  headerText:        { flex: 1 },
  title:             { fontSize: 20, fontWeight: '800', color: Colors.text },
  subtitle:          { fontSize: 13, color: Colors.text2, marginTop: 3, lineHeight: 18 },
  scroll:            { flex: 1 },
  scrollContent:     { padding: Spacing[5], paddingBottom: 20 },
  lgpdBanner:        { flexDirection: 'row', gap: 12, backgroundColor: Colors.bg3, borderRadius: Radius.lg, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  lgpdIcon:          { fontSize: 24, flexShrink: 0 },
  lgpdText:          { flex: 1 },
  lgpdTitle:         { fontSize: 13, fontWeight: '600', color: Colors.text },
  lgpdSub:           { fontSize: 12, color: Colors.text2, marginTop: 3, lineHeight: 17 },
  consentCard:       { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  consentCardOn:     { borderColor: Colors.accent, backgroundColor: '#111800' },
  cardTop:           { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  cardLeft:          { flex: 1 },
  cardTitle:         { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  cardBadgeRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge:             { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeRequired:     { backgroundColor: 'rgba(255,79,79,0.12)' },
  badgeOptional:     { backgroundColor: Colors.bg3 },
  badgeText:         { fontSize: 10, fontWeight: '600' },
  badgeTextRequired: { color: Colors.red },
  badgeTextOptional: { color: Colors.text3 },
  lawRef:            { fontSize: 10, color: Colors.text3 },
  checkbox:          { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkboxOn:        { backgroundColor: Colors.accent, borderColor: Colors.accent },
  checkmark:         { fontSize: 13, color: Colors.bg, fontWeight: '700' },
  cardDesc:          { fontSize: 12, color: Colors.text2, lineHeight: 17 },
  legalLinks:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, marginBottom: 16 },
  legalLink:         { fontSize: 12, color: Colors.accent },
  legalSep:          { fontSize: 12, color: Colors.text3 },
  rightsBox:         { backgroundColor: Colors.bg3, borderRadius: Radius.lg, padding: 14, marginBottom: 8 },
  rightsTitle:       { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  rightsText:        { fontSize: 12, color: Colors.text2, lineHeight: 19 },
  rightsContact:     { fontSize: 11, color: Colors.text3, marginTop: 10 },
  footer:            { padding: Spacing[5], paddingBottom: 36, backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.border },
  footerHint:        { fontSize: 12, color: Colors.text2, textAlign: 'center', marginBottom: 12 },
  btnRow:            { flexDirection: 'row', gap: 10 },
  btnDecline:        { flex: 1, padding: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border2, alignItems: 'center', justifyContent: 'center' },
  btnDeclineText:    { fontSize: 14, fontWeight: '600', color: Colors.text2 },
  btnAccept:         { flex: 2, padding: 14, borderRadius: Radius.md, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  btnAcceptDisabled: { opacity: 0.4 },
  btnAcceptText:     { fontSize: 14, fontWeight: '700', color: Colors.bg },
})
