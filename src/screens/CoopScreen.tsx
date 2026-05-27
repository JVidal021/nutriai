import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Alert, Share,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius } from '@constants/index'
import { useCoopStore, useProgressStore, useUserStore } from '@store/index'
import { generateCoopCode, isValidCoopCode, normalizeCoopCode } from '@utils/coopCode'
import { db } from '@services/supabase'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function CoopScreen() {
  const insets = useSafeAreaInsets()
  const [codeInput, setCodeInput] = useState('')
  const [joining, setJoining]     = useState(false)
  const [myCode, setMyCode]       = useState<string | null>(null)
  const { session, setSession }   = useCoopStore()
  const { user, isLoading }       = useUserStore()
  const { progress }              = useProgressStore()

  // Carrega ou cria o código co-op do usuário no banco (uma só vez)
  useEffect(() => {
    if (!user?.id) return

    const init = async () => {
      try {
        const { data } = await db.getMyCoopCode(user.id)
        if (data?.code) {
          setMyCode(data.code)
        } else {
          const code = generateCoopCode()
          setMyCode(code)
          try {
            await db.createCoopLink(user.id, code)
          } catch (err) {
            console.warn('[NutriAI] Falha ao salvar código Co-op:', err)
          }
        }
      } catch (err) {
        // Tabela pode não existir ainda — gera código local sem salvar
        const code = generateCoopCode()
        setMyCode(code)
        console.warn('[NutriAI] Erro ao carregar código Co-op (tabela ausente?):', err)
      }
    }

    init()
  }, [user?.id])

  if (isLoading || !user) return null

  const handleShareCode = async () => {
    if (!myCode) return
    await Share.share({
      message: `Bora fazer a jornada juntos no NutriAI! 🌿 Usa meu código Co-op: ${myCode}`,
    })
  }

  const handleJoin = async () => {
    const code = normalizeCoopCode(codeInput)
    if (!isValidCoopCode(code)) {
      Alert.alert('Código inválido', 'O código deve estar no formato NUT-XXXX-XXXX.')
      return
    }
    setJoining(true)
    try {
      const { data, error } = await db.findCoopByCode(code)
      if (error || !data) {
        Alert.alert('Código não encontrado', 'Verifique o código e tente novamente.')
        return
      }
      // Simular sessão (em produção: salvar no banco e sincronizar)
      setSession({
        partnerId:          data.user_id,
        partner:            {
          id: data.user_id,
          name: data.users?.name ?? 'Parceiro',
          avatarInitial: (data.users?.name ?? 'P').charAt(0),
          isOnline: false,
          todayCaloriesPercent: 0,
          todayWorkoutDone: false,
          rank: { tier: 'bronze', level: 1, emoji: '🥉', label: 'Bronze I', minXp: 0, maxXp: 333 },
        },
        coopCode:           myCode ?? code,
        daysTogetherCount:  0,
        challengesCompleted:0,
        coopStreak:         0,
        syncedMenu:         { dinner: { user: '—', partner: '—' } },
      })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert('🤝 Co-op ativado!', `Você está conectado com ${data.users?.name ?? 'seu parceiro'}.`)
    } catch {
      Alert.alert('Erro', 'Não foi possível entrar no Co-op. Tente novamente.')
    } finally {
      setJoining(false)
    }
  }

  // No active session — show invite screen
  if (!session) return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>🤝 Modo Co-op</Text>
      <Text style={s.sub}>Faça a jornada em dupla e dobre a motivação.</Text>

      <View style={s.card}>
        <Text style={s.cardTitle}>Seu código Co-op</Text>
        <View style={s.codeBox}>
          <Text style={s.codeText}>{myCode ?? '...'}</Text>
        </View>
        <TouchableOpacity style={[s.shareBtn, !myCode && { opacity: 0.4 }]} onPress={handleShareCode} disabled={!myCode}>
          <Text style={s.shareBtnText}>📤 Compartilhar código</Text>
        </TouchableOpacity>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Entrar com código de um amigo</Text>
        <TextInput
          style={s.codeInput}
          value={codeInput}
          onChangeText={t => setCodeInput(t.toUpperCase())}
          placeholder="NUT-XXXX-XXXX"
          placeholderTextColor={Colors.text3}
          autoCapitalize="characters"
          maxLength={13}
        />
        <TouchableOpacity
          style={[s.joinBtn, joining && { opacity: 0.6 }]}
          onPress={handleJoin}
          disabled={joining}
        >
          <Text style={s.joinBtnText}>{joining ? 'Conectando...' : 'Entrar no Co-op'}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.benefitsCard}>
        <Text style={s.cardTitle}>Benefícios do Co-op</Text>
        {[
          { emoji: '📊', text: 'Compare progresso com seu parceiro em tempo real' },
          { emoji: '🍽️', text: 'Cardápios sincronizados com adaptações individuais' },
          { emoji: '🏆', text: 'Desafios conjuntos com recompensa de +500 XP' },
          { emoji: '💬', text: 'Mande incentivos quando seu parceiro precisar' },
        ].map(b => (
          <View key={b.text} style={s.benefitRow}>
            <Text style={s.benefitEmoji}>{b.emoji}</Text>
            <Text style={s.benefitText}>{b.text}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  )

  // Active session
  const p = session.partner
  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>
      <Text style={s.title}>🤝 Co-op Ativo</Text>
      <Text style={s.sub}>{session.daysTogetherCount} dias juntos</Text>

      {/* Partner card */}
      <View style={s.partnerCard}>
        <View style={s.partnerAvatars}>
          <View style={[s.avatar, { backgroundColor: Colors.accent }]}>
            <Text style={s.avatarText}>{(user?.name ?? 'V').charAt(0)}</Text>
          </View>
          <Text style={{ fontSize: 24 }}>💪</Text>
          <View style={[s.avatar, { backgroundColor: Colors.teal }]}>
            <Text style={s.avatarText}>{p.avatarInitial}</Text>
          </View>
        </View>
        <View style={s.partnerStats}>
          {[
            { label: 'Dias juntos', val: session.daysTogetherCount },
            { label: 'Desafios', val: `${session.challengesCompleted}/10` },
            { label: 'Streak Co-op', val: `🔥 ${session.coopStreak}` },
          ].map(stat => (
            <View key={stat.label} style={s.pStat}>
              <Text style={s.pStatVal}>{stat.val}</Text>
              <Text style={s.pStatLbl}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Progress comparison */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Progresso de hoje</Text>
        {[
          { label: 'Calorias', myVal: 75, partnerVal: p.todayCaloriesPercent || 88 },
          { label: 'Treino', myVal: 100, partnerVal: p.todayWorkoutDone ? 100 : 30 },
        ].map(row => (
          <View key={row.label} style={s.compRow}>
            <Text style={s.compLabel}>{row.label}</Text>
            <View style={s.compBars}>
              <View style={s.compBarWrap}>
                <Text style={s.compName}>Você</Text>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${row.myVal}%`, backgroundColor: Colors.accent }]} />
                </View>
                <Text style={s.compPct}>{row.myVal}%</Text>
              </View>
              <View style={s.compBarWrap}>
                <Text style={s.compName}>{p.name}</Text>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${row.partnerVal}%`, backgroundColor: Colors.teal }]} />
                </View>
                <Text style={s.compPct}>{row.partnerVal}%</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Challenge */}
      <View style={s.challengeCard}>
        <View style={s.cardRow}>
          <Text style={s.cardTitle}>🏆 Desafio ativo</Text>
          <View style={s.challengeBadge}><Text style={s.challengeBadgeText}>5/7 dias</Text></View>
        </View>
        <Text style={s.challengeDesc}>Ambos completam treino e meta calórica por 7 dias seguidos.</Text>
        <View style={s.challengeSegs}>
          {Array.from({ length: 7 }, (_, i) => (
            <View key={i} style={[s.seg, i < 5 && s.segDone]} />
          ))}
        </View>
        <Text style={s.challengeReward}>Recompensa: +500 XP cada 🎉</Text>
      </View>

      <TouchableOpacity style={s.leaveBtn} onPress={() => { setSession(null); setCodeInput('') }}>
        <Text style={s.leaveBtnText}>Sair do Co-op</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:             { flex: 1, backgroundColor: Colors.bg },
  content:          { padding: Spacing[5], paddingBottom: 100 },
  title:            { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  sub:              { fontSize: 13, color: Colors.text2, marginBottom: 16 },
  card:             { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  cardTitle:        { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 10 },
  cardRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  codeBox:          { backgroundColor: Colors.bg3, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
  codeText:         { fontSize: 24, fontWeight: '800', color: Colors.accent, letterSpacing: 4 },
  shareBtn:         { backgroundColor: Colors.bg3, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border2 },
  shareBtnText:     { fontSize: 14, fontWeight: '600', color: Colors.text },
  codeInput:        { backgroundColor: Colors.bg3, borderRadius: 10, padding: 13, fontSize: 16, color: Colors.text, borderWidth: 1, borderColor: Colors.border2, marginBottom: 10, textAlign: 'center', letterSpacing: 3, fontWeight: '700' },
  joinBtn:          { backgroundColor: Colors.accent, borderRadius: 10, padding: 13, alignItems: 'center' },
  joinBtnText:      { fontSize: 14, fontWeight: '700', color: Colors.bg },
  benefitsCard:     { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border },
  benefitRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  benefitEmoji:     { fontSize: 18, width: 24, textAlign: 'center' },
  benefitText:      { flex: 1, fontSize: 13, color: Colors.text2, lineHeight: 18 },
  partnerCard:      { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  partnerAvatars:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 14 },
  avatar:           { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  avatarText:       { fontSize: 18, fontWeight: '800', color: Colors.bg },
  partnerStats:     { flexDirection: 'row', gap: 8 },
  pStat:            { flex: 1, backgroundColor: Colors.bg3, borderRadius: 10, padding: 10, alignItems: 'center' },
  pStatVal:         { fontSize: 16, fontWeight: '700', color: Colors.accent },
  pStatLbl:         { fontSize: 10, color: Colors.text2, marginTop: 2 },
  compRow:          { marginBottom: 12 },
  compLabel:        { fontSize: 12, color: Colors.text2, marginBottom: 6 },
  compBars:         { gap: 5 },
  compBarWrap:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compName:         { fontSize: 11, color: Colors.text2, width: 40 },
  barTrack:         { flex: 1, height: 5, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  barFill:          { height: '100%', borderRadius: 3 },
  compPct:          { fontSize: 11, color: Colors.text2, width: 30, textAlign: 'right' },
  challengeCard:    { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  challengeBadge:   { backgroundColor: Colors.accent + '18', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  challengeBadgeText:{ fontSize: 11, fontWeight: '600', color: Colors.accent },
  challengeDesc:    { fontSize: 13, color: Colors.text2, marginBottom: 10 },
  challengeSegs:    { flexDirection: 'row', gap: 5, marginBottom: 8 },
  seg:              { flex: 1, height: 5, borderRadius: 3, backgroundColor: Colors.border },
  segDone:          { backgroundColor: Colors.accent },
  challengeReward:  { fontSize: 11, color: Colors.text2 },
  leaveBtn:         { borderWidth: 1, borderColor: Colors.border2, borderRadius: Radius.md, padding: 13, alignItems: 'center' },
  leaveBtnText:     { fontSize: 14, fontWeight: '600', color: Colors.text2 },
})
