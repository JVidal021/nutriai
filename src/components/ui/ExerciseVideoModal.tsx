import React, { useState } from 'react'
import {
  Modal, View, Text, StyleSheet,
  TouchableOpacity, ActivityIndicator, Dimensions,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { Colors, Radius } from '@constants/index'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const { height: SCREEN_H } = Dimensions.get('window')

// Altura da sheet: ~78% da tela para dar espaço confortável ao vídeo
const SHEET_H = Math.round(SCREEN_H * 0.78)

interface Props {
  visible:      boolean
  exerciseName: string
  searchName?:  string
  onClose:      () => void
}

export default function ExerciseVideoModal({ visible, exerciseName, searchName, onClose }: Props) {
  const insets  = useSafeAreaInsets()
  const [loading, setLoading] = useState(true)

  // m.youtube.com é a versão mobile completa — sem restrições de embed,
  // sem erro 153. Vídeos abrem inline dentro do WebView.
  const query = encodeURIComponent(
    searchName
      ? `${searchName} exercise tutorial proper form`
      : `${exerciseName} como fazer academia`
  )
  const uri = `https://m.youtube.com/results?search_query=${query}`

  // User agent mobile explícito para garantir layout otimizado
  const MOBILE_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
    'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop — toque para fechar */}
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />

      {/* Sheet */}
      <View style={[s.sheet, { height: SHEET_H, paddingBottom: insets.bottom + 4 }]}>

        {/* Handle */}
        <View style={s.handle} />

        {/* Cabeçalho */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.tag}>▶ DEMONSTRAÇÃO</Text>
            <Text style={s.title} numberOfLines={2}>{exerciseName}</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={s.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={s.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* WebView com YouTube mobile */}
        <View style={s.webFrame}>
          {loading && (
            <View style={s.loader}>
              <ActivityIndicator size="large" color={Colors.accent} />
              <Text style={s.loaderText}>Buscando demonstrações...</Text>
            </View>
          )}
          <WebView
            key={`${exerciseName}-${visible}`}
            source={{ uri }}
            style={s.webview}
            userAgent={MOBILE_UA}
            onLoadEnd={() => setLoading(false)}
            onError={() => setLoading(false)}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            allowsFullscreenVideo
            startInLoadingState={false}
          />
        </View>

        <Text style={s.hint}>Toque em um vídeo para assistir · Toque fora para fechar</Text>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },

  sheet: {
    backgroundColor: Colors.bg2,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border2,
    alignSelf: 'center',
    marginBottom: 12,
  },

  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12, gap: 12,
  },
  headerLeft: { flex: 1, gap: 2 },
  tag:        { fontSize: 10, fontWeight: '800', color: Colors.accent, letterSpacing: 0.8 },
  title:      { fontSize: 16, fontWeight: '800', color: Colors.text, lineHeight: 22 },

  closeBtn:   {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.bg3,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  closeIcon:  { fontSize: 13, color: Colors.text2, fontWeight: '700' },

  webFrame: {
    flex: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg3,
  },

  loader: {
    position: 'absolute', inset: 0,
    backgroundColor: Colors.bg3,
    alignItems: 'center', justifyContent: 'center',
    gap: 10, zIndex: 10,
  },
  loaderText: { fontSize: 13, color: Colors.text2 },

  webview:    { flex: 1, backgroundColor: Colors.bg3 },

  hint: {
    textAlign: 'center',
    fontSize: 11,
    color: Colors.text3,
    marginTop: 8,
  },
})
