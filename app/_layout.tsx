import { useEffect, useState } from 'react'
import { Stack, SplashScreen } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StyleSheet } from 'react-native'
import { I18nextProvider } from 'react-i18next'
import { useUserStore } from '@store/index'
import { supabase } from '@services/supabase'
import { dbUserToUser } from '@utils/index'
import TrialExpiredModal from '@components/TrialExpiredModal'
import {
  requestNotificationPermission,
  scheduleDailyReminders,
  addNotificationResponseListener,
} from '@services/notifications'
import { router } from 'expo-router'
import {
  useFonts,
  Syne_600SemiBold,
  Syne_800ExtraBold,
} from '@expo-google-fonts/syne'
import {
  DMSans_300Light,
  DMSans_400Regular,
  DMSans_500Medium,
} from '@expo-google-fonts/dm-sans'
import i18n, { initI18n } from '@/i18n/index'
import { ErrorBoundary } from '@components/ErrorBoundary'

// Mantém o splash screen enquanto as fontes carregam
SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const { setUser, clearUser, setLoading, updateUser } = useUserStore()
  const [showTrialExpired, setShowTrialExpired] = useState(false)
  const [i18nReady, setI18nReady] = useState(false)

  const [fontsLoaded, fontError] = useFonts({
    Syne_600SemiBold,
    Syne_800ExtraBold,
    DMSans_300Light,
    DMSans_400Regular,
    DMSans_500Medium,
  })

  // Inicializa i18n na primeira montagem
  useEffect(() => {
    initI18n().then(() => setI18nReady(true))
  }, [])

  // Esconde o splash assim que as fontes e i18n estiverem prontos
  useEffect(() => {
    if ((fontsLoaded || fontError) && i18nReady) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded, fontError, i18nReady])

  useEffect(() => {
    let settled = false
    const finish = () => { if (!settled) { settled = true; setLoading(false) } }

    const timeout = setTimeout(finish, 8000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION') {
          // Restaura sessão existente ao abrir o app
          if (session?.user) {
            const { data } = await supabase
              .from('users').select('*').eq('id', session.user.id).single()
            if (data) {
              const mappedUser = dbUserToUser(data)
              setUser(mappedUser)

              // ── Verificar expiração do trial ────────────────────────
              if (
                mappedUser.premiumPlan === 'trial' &&
                mappedUser.isPremium &&
                mappedUser.premiumExpiresAt &&
                new Date(mappedUser.premiumExpiresAt) < new Date()
              ) {
                // Revoga o premium localmente e no banco
                await supabase.from('users').update({
                  is_premium: false,
                  updated_at: new Date().toISOString(),
                }).eq('id', session.user.id)
                updateUser({ isPremium: false })
                setShowTrialExpired(true)
              }
            }
          }
          finish()
        } else if (event === 'SIGNED_OUT') {
          clearUser()
          router.replace('/onboarding')
        }
        // SIGNED_IN: tratado diretamente pelo OnboardingScreen (handleLogin / finish)
      }
    )

    requestNotificationPermission().then((granted) => {
      if (granted) scheduleDailyReminders()
    })

    const notifListener = addNotificationResponseListener((screen) => {
      if (screen === 'scan')    router.push('/(tabs)/scan')
      if (screen === 'home')    router.push('/(tabs)/home')
      if (screen === 'workout') router.push('/(tabs)/workout')
    })

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
      notifListener.remove()
    }
  }, [])

  if (!i18nReady) return null

  return (
    <ErrorBoundary>
    <I18nextProvider i18n={i18n}>
    <SafeAreaProvider>
    <GestureHandlerRootView style={s.root}>
      <StatusBar style="light" />
      <TrialExpiredModal
        visible={showTrialExpired}
        onContinueFree={() => setShowTrialExpired(false)}
      />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="profile/delete-account"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="profile/export"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="profile/privacy"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="legal/terms"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="legal/privacy"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="legal/lgpd"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
      </Stack>
    </GestureHandlerRootView>
    </SafeAreaProvider>
    </I18nextProvider>
    </ErrorBoundary>
  )
}

const s = StyleSheet.create({ root: { flex: 1 } })
