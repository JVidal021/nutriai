import React from 'react'
import {
  Modal, View, Text, StyleSheet,
  TouchableOpacity, ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@constants/index'

interface Props {
  visible: boolean
  onContinueFree: () => void
}

const LOST_FEATURES = [
  '📸 Fotos ilimitadas para análise',
  '🤖 Dieta personalizada por IA',
  '💪 Treinos gerados para você',
  '🌿 Coach IA sem limite de mensagens',
  '📊 Relatório semanal detalhado',
  '🏆 Sistema de ranks completo',
  '🤝 Modo Co-op e desafios',
]

export default function TrialExpiredModal({ visible, onContinueFree }: Props) {
  const handleSubscribe = () => {
    onContinueFree() // fecha o modal
    router.push('/(tabs)/subscription' as never)
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={s.overlay}>
        <View style={s.sheet}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

            <Text style={s.emoji}>⏰</Text>
            <Text style={s.title}>Seu trial Premium acabou</Text>
            <Text style={s.sub}>
              Seus 15 dias de teste gratuito chegaram ao fim. Foi um prazer ter você no Premium!
            </Text>

            <View style={s.featuresCard}>
              <Text style={s.featuresTitle}>O que você tinha acesso:</Text>
              {LOST_FEATURES.map(f => (
                <Text key={f} style={s.featureItem}>{f}</Text>
              ))}
            </View>

            <TouchableOpacity style={s.btnPrimary} onPress={handleSubscribe}>
              <Text style={s.btnPrimaryText}>👑 Assinar Premium agora</Text>
              <Text style={s.btnPrimarySub}>A partir de R$29/mês · cancele quando quiser</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.btnSecondary} onPress={onContinueFree}>
              <Text style={s.btnSecondaryText}>Continuar no plano grátis</Text>
            </TouchableOpacity>

            <Text style={s.legal}>
              Dúvidas? suporte.nutriai@outlook.com
            </Text>

          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  sheet:          { backgroundColor: Colors.bg2, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: Colors.border, maxHeight: '90%' },
  scroll:         { padding: Spacing[6], paddingBottom: 48, alignItems: 'center' },
  emoji:          { fontSize: 52, marginBottom: 12 },
  title:          { fontSize: 24, fontWeight: '900', color: Colors.text, textAlign: 'center', marginBottom: 8, letterSpacing: -0.5 },
  sub:            { fontSize: 14, color: Colors.text2, textAlign: 'center', lineHeight: 20, marginBottom: 20, maxWidth: 300 },
  featuresCard:   { width: '100%', backgroundColor: Colors.bg3, borderRadius: Radius.lg, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: Colors.border },
  featuresTitle:  { fontSize: 12, fontWeight: '700', color: Colors.text2, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  featureItem:    { fontSize: 13, color: Colors.text, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.border },
  btnPrimary:     { width: '100%', backgroundColor: Colors.accent, borderRadius: Radius.md, padding: 16, alignItems: 'center', marginBottom: 10 },
  btnPrimaryText: { fontSize: 16, fontWeight: '800', color: Colors.bg },
  btnPrimarySub:  { fontSize: 11, color: Colors.bg, opacity: 0.7, marginTop: 3 },
  btnSecondary:   { width: '100%', borderWidth: 1, borderColor: Colors.border2, borderRadius: Radius.md, padding: 14, alignItems: 'center', marginBottom: 16 },
  btnSecondaryText: { fontSize: 14, fontWeight: '600', color: Colors.text2 },
  legal:          { fontSize: 11, color: Colors.text3 },
})
