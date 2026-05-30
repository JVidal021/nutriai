import React from 'react'
import {
  Modal, View, Text, StyleSheet,
  TouchableOpacity, ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { Colors, Spacing, Radius } from '@constants/index'
import { useT } from '@/i18n/useT'

const LOST_FEATURE_KEYS = [
  'trial_expired.feat_1',
  'trial_expired.feat_2',
  'trial_expired.feat_3',
  'trial_expired.feat_4',
  'trial_expired.feat_5',
  'trial_expired.feat_6',
  'trial_expired.feat_7',
]

interface Props {
  visible: boolean
  onContinueFree: () => void
}

export default function TrialExpiredModal({ visible, onContinueFree }: Props) {
  const { t } = useT()

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
            <Text style={s.title}>{t('trial_expired.title' as any)}</Text>
            <Text style={s.sub}>{t('trial_expired.sub' as any)}</Text>

            <View style={s.featuresCard}>
              <Text style={s.featuresTitle}>{t('trial_expired.features_title' as any)}</Text>
              {LOST_FEATURE_KEYS.map(key => (
                <Text key={key} style={s.featureItem}>{t(key as any)}</Text>
              ))}
            </View>

            <TouchableOpacity style={s.btnPrimary} onPress={handleSubscribe}>
              <Text style={s.btnPrimaryText}>{t('trial_expired.subscribe_btn' as any)}</Text>
              <Text style={s.btnPrimarySub}>{t('trial_expired.price_sub' as any)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.btnSecondary} onPress={onContinueFree}>
              <Text style={s.btnSecondaryText}>{t('trial_expired.continue_free' as any)}</Text>
            </TouchableOpacity>

            <Text style={s.legal}>{t('trial_expired.legal' as any)}</Text>

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
