import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { Colors, Spacing, Radius } from '@constants/index'
import i18n from '@/i18n/index'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * ErrorBoundary global — captura qualquer erro de renderização que escape
 * dos componentes filhos e mostra uma tela amigável em vez de crashar o app.
 *
 * É um class component porque getDerivedStateFromError / componentDidCatch
 * só existem em classes. Os textos usam i18n.t() diretamente (a instância,
 * não o hook), pois hooks não funcionam em class components.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log para diagnóstico (removido em produção pelo transform-remove-console)
    console.error('[ErrorBoundary] Erro capturado:', error, info.componentStack)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    // t() da instância — funciona fora de componente React
    const t = (k: string) => i18n.t(k)

    return (
      <View style={s.root}>
        <ScrollView contentContainerStyle={s.content}>
          <Text style={s.emoji}>🌿</Text>
          <Text style={s.title}>{t('error_boundary.title')}</Text>
          <Text style={s.message}>{t('error_boundary.message')}</Text>

          <TouchableOpacity style={s.btn} onPress={this.handleReload} activeOpacity={0.85}>
            <Text style={s.btnText}>{t('error_boundary.reload')}</Text>
          </TouchableOpacity>

          <Text style={s.report}>{t('error_boundary.report')}</Text>

          {__DEV__ && this.state.error && (
            <View style={s.devBox}>
              <Text style={s.devTitle}>DEV — detalhes do erro:</Text>
              <Text style={s.devText}>{this.state.error.message}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    )
  }
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: Colors.bg },
  content:  { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing[6] },
  emoji:    { fontSize: 56, marginBottom: 20 },
  title:    { fontSize: 22, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 12 },
  message:  { fontSize: 15, color: Colors.text2, textAlign: 'center', lineHeight: 22, marginBottom: 32, maxWidth: 320 },
  btn:      { backgroundColor: Colors.accent, borderRadius: Radius.md, paddingVertical: 15, paddingHorizontal: 36, alignItems: 'center', marginBottom: 24 },
  btnText:  { fontSize: 15, fontWeight: '800', color: Colors.bg },
  report:   { fontSize: 12, color: Colors.text3, textAlign: 'center', lineHeight: 18 },
  devBox:   { marginTop: 32, padding: 14, backgroundColor: Colors.bg2, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.red + '40', maxWidth: 340 },
  devTitle: { fontSize: 11, fontWeight: '700', color: Colors.red, marginBottom: 6 },
  devText:  { fontSize: 12, color: Colors.text2, fontFamily: 'monospace' },
})
