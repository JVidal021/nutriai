import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Radius } from '@constants/index'
import { useT } from '@/i18n/useT'

interface Props {
  password: string
}

/**
 * Indicador visual de força de senha + checklist de requisitos em tempo real.
 * Mesmas regras da validação de cadastro (8+, maiúscula, minúscula, número, símbolo).
 * Não renderiza nada se o campo estiver vazio.
 */
export function PasswordStrength({ password }: Props) {
  const { t } = useT()

  const checks = useMemo(() => ([
    { key: 'pwd_req_length', ok: password.length >= 8 },
    { key: 'pwd_req_upper',  ok: /[A-Z]/.test(password) },
    { key: 'pwd_req_lower',  ok: /[a-z]/.test(password) },
    { key: 'pwd_req_digit',  ok: /[0-9]/.test(password) },
    { key: 'pwd_req_symbol', ok: /[^A-Za-z0-9]/.test(password) },
  ]), [password])

  if (password.length === 0) return null

  const passed = checks.filter(c => c.ok).length

  // 0–2 fraca · 3–4 média · 5 forte
  const level   = passed <= 2 ? 0 : passed <= 4 ? 1 : 2
  const colors  = [Colors.red, Colors.orange, Colors.accent]
  const labels  = ['errors.pwd_strength_weak', 'errors.pwd_strength_medium', 'errors.pwd_strength_strong']
  const barColor = colors[level]

  return (
    <View style={s.wrap}>
      {/* Barra de força (3 segmentos) */}
      <View style={s.barRow}>
        {[0, 1, 2].map(i => (
          <View
            key={i}
            style={[
              s.barSeg,
              { backgroundColor: i <= level ? barColor : Colors.bg3 },
            ]}
          />
        ))}
        <Text style={[s.levelLabel, { color: barColor }]}>{t(labels[level] as any)}</Text>
      </View>

      {/* Checklist de requisitos */}
      <View style={s.checksRow}>
        {checks.map(c => (
          <View key={c.key} style={s.checkItem}>
            <Text style={[s.checkIcon, { color: c.ok ? Colors.accent : Colors.text3 }]}>
              {c.ok ? '✓' : '○'}
            </Text>
            <Text style={[s.checkText, { color: c.ok ? Colors.text2 : Colors.text3 }]}>
              {t(`errors.${c.key}` as any)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap:       { marginTop: 8, gap: 8 },
  barRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  barSeg:     { flex: 1, height: 4, borderRadius: 2 },
  levelLabel: { fontSize: 11, fontWeight: '700', marginLeft: 6, minWidth: 44 },
  checksRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  checkItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  checkIcon:  { fontSize: 11, fontWeight: '800', width: 12, textAlign: 'center' },
  checkText:  { fontSize: 11 },
})
