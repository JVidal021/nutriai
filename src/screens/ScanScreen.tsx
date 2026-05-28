import React, { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, Image,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius, XP_VALUES } from '@constants/index'
import { analyzeMealPhoto, analyzeMealText } from '@services/ai'
import { db } from '@services/supabase'
import { useUserStore, useNutritionStore, useProgressStore } from '@store/index'
import type { ScanResult, Meal } from '@types/index'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// BUG 5 FIX: determinar tipo da refeição pelo horário do dia
function getMealTypeFromTime(): Meal['type'] {
  const h = new Date().getHours()
  if (h >= 5  && h < 10) return 'breakfast'
  if (h >= 10 && h < 15) return 'lunch'
  if (h >= 17 && h < 21) return 'dinner'
  return 'snack'
}

type ScanMode  = 'photo' | 'text'
type ScanState = 'idle' | 'camera' | 'analyzing' | 'result'

// ─── Exemplos de texto para o placeholder ────────────────────────────────
const TEXT_EXAMPLES = [
  'Ex: prato de arroz com feijão, frango grelhado e salada',
  'Ex: 2 fatias de pizza de queijo',
  'Ex: omelete com 3 ovos, queijo e presunto',
  'Ex: açaí 400ml com granola e banana',
  'Ex: coxinha grande e suco de laranja',
]

export default function ScanScreen() {
  const insets = useSafeAreaInsets()
  const [permission, requestPermission] = useCameraPermissions()
  const [mode, setMode]           = useState<ScanMode>('photo')
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [photoUri, setPhotoUri]   = useState<string | null>(null)
  const [result, setResult]       = useState<ScanResult | null>(null)
  const [textInput, setTextInput] = useState('')
  const [placeholder] = useState(
    TEXT_EXAMPLES[Math.floor(Math.random() * TEXT_EXAMPLES.length)]
  )
  const cameraRef = useRef<CameraView>(null)

  const { user, isLoading } = useUserStore()
  const { addMeal } = useNutritionStore()
  const { addXp }   = useProgressStore()

  if (isLoading || !user) return null

  // ─── CÂMERA ───────────────────────────────────────────────────────────
  const openCamera = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission()
      if (!granted) {
        Alert.alert('Câmera necessária', 'O NutriAI precisa da câmera para analisar seu prato.')
        return
      }
    }
    setScanState('camera')
  }

  const pickFromGallery = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!granted) return
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    })
    if (!res.canceled && res.assets[0]) await analyzePhoto(res.assets[0].uri)
  }

  const takePicture = async () => {
    if (!cameraRef.current) return
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 })
    if (photo) await analyzePhoto(photo.uri)
  }

  // ─── ANÁLISE POR FOTO ─────────────────────────────────────────────────
  const analyzePhoto = async (uri: string) => {
    setPhotoUri(uri)
    setScanState('analyzing')
    try {
      const scanResult = await analyzeMealPhoto(uri)
      setResult(scanResult)
      setScanState('result')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (err) {
      Alert.alert('Erro na análise', err instanceof Error ? err.message : 'Tente novamente.')
      reset()
    }
  }

  // ─── ANÁLISE POR TEXTO ────────────────────────────────────────────────
  const analyzeText = async () => {
    const text = textInput.trim()
    if (text.length < 3) {
      Alert.alert('Descrição muito curta', 'Descreva o prato com pelo menos 3 caracteres.')
      return
    }
    setScanState('analyzing')
    try {
      const scanResult = await analyzeMealText(text)
      setResult(scanResult)
      setScanState('result')
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (err) {
      Alert.alert('Erro na análise', err instanceof Error ? err.message : 'Tente novamente.')
      setScanState('idle')
    }
  }

  // ─── SALVAR REFEIÇÃO ──────────────────────────────────────────────────
  const addToLog = () => {
    if (!result) return
    const meal: Meal = {
      id:           Date.now().toString(),
      userId:       user.id,
      // BUG 5 FIX: tipo determinado pelo horário, não hardcoded como 'lunch'
      type:         getMealTypeFromTime(),
      foods:        result.foods.map((f, i) => ({
        id:       `${i}`,
        name:     f.name,
        quantity: f.quantity_g,
        macros:   {
          calories: f.calories,
          protein:  f.protein_g,
          carbs:    f.carbs_g,
          fat:      f.fat_g,
        },
      })),
      totalMacros:  result.total,
      photoUrl:     photoUri ?? undefined,
      aiConfidence: result.confidence,
      loggedAt:     new Date().toISOString(),
    }

    // Persiste localmente (estado imediato)
    addMeal(meal)

    // BUG 4 FIX: persistir refeição no Supabase (fire-and-forget para não bloquear a UI)
    if (user?.id) {
      db.logMeal({
        id:            meal.id,
        user_id:       meal.userId,
        type:          meal.type,
        foods:         meal.foods,
        total_macros:  meal.totalMacros,
        photo_url:     meal.photoUrl ?? null,
        ai_confidence: meal.aiConfidence ?? null,
        logged_at:     meal.loggedAt,
      }).then(
        () => {},
        (err) => console.warn('[NutriAI] Falha ao salvar refeição no banco:', err)
      )
    }

    addXp('MEAL_LOGGED')
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    reset()
    Alert.alert('✓ Adicionado!', `+${XP_VALUES.MEAL_LOGGED} XP ganhos`)
  }

  const reset = () => {
    setScanState('idle')
    setPhotoUri(null)
    setResult(null)
    setTextInput('')
  }

  // ─── CÂMERA ATIVA ────────────────────────────────────────────────────
  if (scanState === 'camera') return (
    <View style={s.cameraContainer}>
      <CameraView ref={cameraRef} style={s.camera} facing="back">
        <View style={s.cameraOverlay}>
          <View style={s.cameraFrame} />
          <Text style={s.cameraHint}>Enquadre o prato inteiro</Text>
        </View>
        <View style={s.cameraControls}>
          <TouchableOpacity style={s.cameraCancelBtn} onPress={reset}>
            <Text style={s.cameraCancelText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.shutterBtn} onPress={takePicture}>
            <View style={s.shutterInner} />
          </TouchableOpacity>
          <TouchableOpacity style={s.galleryBtn} onPress={pickFromGallery}>
            <Text style={s.galleryText}>🖼️</Text>
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  )

  // ─── ANALISANDO ───────────────────────────────────────────────────────
  if (scanState === 'analyzing') return (
    <View style={s.analyzingWrap}>
      <ActivityIndicator size="large" color={Colors.accent} />
      <Text style={s.analyzingTitle}>Analisando{mode === 'text' ? ' descrição' : ' foto'}...</Text>
      <Text style={s.analyzingSub}>A IA está identificando os alimentos</Text>
    </View>
  )

  // ─── RESULTADO ────────────────────────────────────────────────────────
  if (scanState === 'result' && result) return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]}>
      <Text style={s.title}>✅ Análise concluída</Text>

      {photoUri && (
        <Image source={{ uri: photoUri }} style={s.resultPhoto} />
      )}

      {/* Totais */}
      <View style={s.totalsCard}>
        <Text style={s.totalsTitle}>Total da refeição</Text>
        <View style={s.macrosGrid}>
          {[
            { label: 'Calorias', val: result.total.calories, unit: 'kcal', color: Colors.accent  },
            { label: 'Proteína', val: result.total.protein,  unit: 'g',    color: Colors.purple  },
            { label: 'Carboidr.', val: result.total.carbs,   unit: 'g',    color: Colors.teal    },
            { label: 'Gordura',  val: result.total.fat,      unit: 'g',    color: Colors.orange  },
          ].map(m => (
            <View key={m.label} style={s.macroBox}>
              <Text style={[s.macroVal, { color: m.color }]}>{Math.round(m.val)}</Text>
              <Text style={s.macroUnit}>{m.unit}</Text>
              <Text style={s.macroLabel}>{m.label}</Text>
            </View>
          ))}
        </View>
        <View style={s.confidenceRow}>
          <Text style={s.confidenceText}>
            Confiança da IA: {result.confidence}%
          </Text>
          <View style={[s.confidenceBar, { width: `${result.confidence}%` }]} />
        </View>
        {result.notes && (
          <Text style={s.notesText}>💬 {result.notes}</Text>
        )}
      </View>

      {/* Lista de alimentos */}
      <View style={s.foodsCard}>
        <Text style={s.foodsTitle}>Alimentos identificados</Text>
        {result.foods.map((food, i) => (
          <View key={i} style={s.foodRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.foodName}>{food.name}</Text>
              <Text style={s.foodQty}>{food.quantity_g}g</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.foodCal}>{Math.round(food.calories)} kcal</Text>
              <Text style={s.foodMacros}>
                P:{Math.round(food.protein_g)}g · C:{Math.round(food.carbs_g)}g · G:{Math.round(food.fat_g)}g
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Ações */}
      <TouchableOpacity style={s.addBtn} onPress={addToLog}>
        <Text style={s.addBtnText}>+ Adicionar ao diário  •  +{XP_VALUES.MEAL_LOGGED} XP</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.retryBtn} onPress={reset}>
        <Text style={s.retryBtnText}>Analisar outra refeição</Text>
      </TouchableOpacity>
    </ScrollView>
  )

  // ─── IDLE — tela principal com duas abas ─────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]} keyboardShouldPersistTaps="handled">

        <Text style={s.title}>🍽️ Registrar refeição</Text>
        <Text style={s.sub}>Fotografe ou descreva o que você comeu</Text>

        {/* Toggle de modo */}
        <View style={s.modeToggle}>
          <TouchableOpacity
            style={[s.modeBtn, mode === 'photo' && s.modeBtnActive]}
            onPress={() => setMode('photo')}
          >
            <Text style={s.modeBtnEmoji}>📷</Text>
            <Text style={[s.modeBtnText, mode === 'photo' && s.modeBtnTextActive]}>
              Foto
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.modeBtn, mode === 'text' && s.modeBtnActive]}
            onPress={() => setMode('text')}
          >
            <Text style={s.modeBtnEmoji}>✏️</Text>
            <Text style={[s.modeBtnText, mode === 'text' && s.modeBtnTextActive]}>
              Descrever
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── MODO FOTO ─────────────────────────────────────────── */}
        {mode === 'photo' && (
          <>
            <TouchableOpacity style={s.cameraZone} onPress={openCamera}>
              <Text style={s.cameraZoneIcon}>📷</Text>
              <Text style={s.cameraZoneText}>Toque para fotografar</Text>
              <Text style={s.cameraZoneSub}>Melhor resultado com boa iluminação</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.galleryZone} onPress={pickFromGallery}>
              <Text style={s.galleryZoneText}>🖼️  Escolher da galeria</Text>
            </TouchableOpacity>

            <View style={s.tipsCard}>
              <Text style={s.tipsTitle}>Dicas para melhor resultado</Text>
              {[
                '📐 Fotografe de cima (visão aérea)',
                '💡 Boa iluminação — evite sombras',
                '🍽️ Enquadre o prato inteiro',
                '🔍 Separe os alimentos se possível',
              ].map(tip => (
                <Text key={tip} style={s.tipItem}>{tip}</Text>
              ))}
            </View>
          </>
        )}

        {/* ─── MODO TEXTO ────────────────────────────────────────── */}
        {mode === 'text' && (
          <>
            <View style={s.textCard}>
              <Text style={s.textCardTitle}>Descreva o que você comeu</Text>
              <Text style={s.textCardSub}>
                Pode ser o nome do prato, os ingredientes ou a quantidade.
                Quanto mais detalhes, mais precisa é a análise.
              </Text>
              <TextInput
                style={s.textInput}
                value={textInput}
                onChangeText={setTextInput}
                placeholder={placeholder}
                placeholderTextColor={Colors.text3}
                multiline
                numberOfLines={4}
                maxLength={500}
                textAlignVertical="top"
                autoFocus
              />
              <Text style={s.charCount}>{textInput.length}/500</Text>
            </View>

            {/* Sugestões rápidas */}
            <Text style={s.suggestTitle}>Sugestões rápidas</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.suggestScroll}>
              {[
                'Arroz, feijão e frango',
                'Salada com atum',
                'Pão com ovo mexido',
                'Vitamina de banana',
                'Lanche natural',
                'Macarrão ao molho',
                'Sopa de legumes',
                'Iogurte com frutas',
              ].map(s => (
                <TouchableOpacity
                  key={s}
                  style={styles.suggestChip}
                  onPress={() => setTextInput(prev => prev ? `${prev}, ${s.toLowerCase()}` : s)}
                >
                  <Text style={styles.suggestChipText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[s.analyzeTextBtn, textInput.trim().length < 3 && { opacity: 0.4 }]}
              onPress={analyzeText}
              disabled={textInput.trim().length < 3}
            >
              <Text style={s.analyzeTextBtnText}>✨ Analisar calorias</Text>
            </TouchableOpacity>

            <View style={s.tipsCard}>
              <Text style={s.tipsTitle}>Exemplos de descrição</Text>
              {[
                '"2 ovos mexidos com queijo + 2 fatias de pão integral"',
                '"Prato de feijoada completa com arroz e couve"',
                '"Frango grelhado 150g, batata doce 200g e brócolis"',
                '"Açaí 400ml com granola 50g e banana"',
              ].map(ex => (
                <TouchableOpacity
                  key={ex}
                  onPress={() => setTextInput(ex.replace(/"/g, ''))}
                >
                  <Text style={s.exampleItem}>{ex}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// Alias local para evitar conflito de nome com variável 's'
const styles = StyleSheet.create({
  suggestChip:     { backgroundColor: Colors.bg3, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, borderWidth: 1, borderColor: Colors.border },
  suggestChipText: { fontSize: 12, color: Colors.text2 },
})

const s = StyleSheet.create({
  root:              { flex: 1, backgroundColor: Colors.bg },
  content:           { padding: Spacing[5], paddingBottom: 100 },
  title:             { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  sub:               { fontSize: 13, color: Colors.text2, marginBottom: 16 },

  // Toggle de modo
  modeToggle:        { flexDirection: 'row', backgroundColor: Colors.bg3, borderRadius: 14, padding: 4, marginBottom: 16 },
  modeBtn:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 11 },
  modeBtnActive:     { backgroundColor: Colors.bg2, borderWidth: 1, borderColor: Colors.border2 },
  modeBtnEmoji:      { fontSize: 16 },
  modeBtnText:       { fontSize: 13, fontWeight: '600', color: Colors.text2 },
  modeBtnTextActive: { color: Colors.text },

  // Modo foto
  cameraZone:        { backgroundColor: Colors.bg2, borderRadius: Radius.lg, borderWidth: 2, borderColor: Colors.accent + '40', borderStyle: 'dashed', padding: 40, alignItems: 'center', marginBottom: 10 },
  cameraZoneIcon:    { fontSize: 48, marginBottom: 10 },
  cameraZoneText:    { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  cameraZoneSub:     { fontSize: 12, color: Colors.text2 },
  galleryZone:       { backgroundColor: Colors.bg3, borderRadius: Radius.md, padding: 13, alignItems: 'center', marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  galleryZoneText:   { fontSize: 14, fontWeight: '600', color: Colors.text2 },

  // Modo texto
  textCard:          { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  textCardTitle:     { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  textCardSub:       { fontSize: 12, color: Colors.text2, marginBottom: 12, lineHeight: 17 },
  textInput:         { backgroundColor: Colors.bg3, borderRadius: Radius.md, padding: 13, fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.border2, minHeight: 100 },
  charCount:         { fontSize: 11, color: Colors.text3, textAlign: 'right', marginTop: 4 },
  suggestTitle:      { fontSize: 12, fontWeight: '600', color: Colors.text2, marginBottom: 8 },
  suggestScroll:     { marginBottom: 14 },
  analyzeTextBtn:    { backgroundColor: Colors.accent, borderRadius: Radius.md, padding: 14, alignItems: 'center', marginBottom: 14 },
  analyzeTextBtnText:{ fontSize: 15, fontWeight: '800', color: Colors.bg },
  exampleItem:       { fontSize: 12, color: Colors.accent, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: Colors.border },

  // Dicas
  tipsCard:          { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border },
  tipsTitle:         { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  tipItem:           { fontSize: 12, color: Colors.text2, paddingVertical: 3 },

  // Câmera
  cameraContainer:   { flex: 1 },
  camera:            { flex: 1 },
  cameraOverlay:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  cameraFrame:       { width: 260, height: 260, borderRadius: 20, borderWidth: 2, borderColor: Colors.accent + '80' },
  cameraHint:        { color: '#FFF', fontSize: 13, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  cameraControls:    { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 48, paddingHorizontal: 40 },
  cameraCancelBtn:   { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  cameraCancelText:  { fontSize: 18, color: '#FFF', fontWeight: '700' },
  shutterBtn:        { width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  shutterInner:      { width: 58, height: 58, borderRadius: 29, backgroundColor: Colors.accent },
  galleryBtn:        { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  galleryText:       { fontSize: 22 },

  // Analisando
  analyzingWrap:     { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  analyzingTitle:    { fontSize: 18, fontWeight: '700', color: Colors.text },
  analyzingSub:      { fontSize: 13, color: Colors.text2 },

  // Resultado
  resultPhoto:       { width: '100%', height: 200, borderRadius: Radius.lg, marginBottom: 12, resizeMode: 'cover' },
  totalsCard:        { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  totalsTitle:       { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 12 },
  macrosGrid:        { flexDirection: 'row', gap: 8, marginBottom: 12 },
  macroBox:          { flex: 1, backgroundColor: Colors.bg3, borderRadius: 10, padding: 10, alignItems: 'center' },
  macroVal:          { fontSize: 18, fontWeight: '800' },
  macroUnit:         { fontSize: 10, color: Colors.text2 },
  macroLabel:        { fontSize: 9, color: Colors.text3, marginTop: 1 },
  confidenceRow:     { marginBottom: 8 },
  confidenceText:    { fontSize: 11, color: Colors.text2, marginBottom: 4 },
  confidenceBar:     { height: 3, backgroundColor: Colors.teal, borderRadius: 2 },
  notesText:         { fontSize: 12, color: Colors.text2, fontStyle: 'italic' },
  foodsCard:         { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  foodsTitle:        { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 10 },
  foodRow:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  foodName:          { fontSize: 13, fontWeight: '500', color: Colors.text },
  foodQty:           { fontSize: 11, color: Colors.text2, marginTop: 1 },
  foodCal:           { fontSize: 14, fontWeight: '700', color: Colors.accent },
  foodMacros:        { fontSize: 10, color: Colors.text2, marginTop: 2 },
  addBtn:            { backgroundColor: Colors.accent, borderRadius: Radius.md, padding: 15, alignItems: 'center', marginBottom: 10 },
  addBtnText:        { fontSize: 15, fontWeight: '800', color: Colors.bg },
  retryBtn:          { borderWidth: 1, borderColor: Colors.border2, borderRadius: Radius.md, padding: 13, alignItems: 'center' },
  retryBtnText:      { fontSize: 14, fontWeight: '600', color: Colors.text2 },
})
