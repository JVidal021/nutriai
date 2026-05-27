import { useEffect, useState } from 'react'
import { Stack, SplashScreen } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StyleSheet } from 'react-native'
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

// Mantém o splash screen enquanto as fontes carregam
SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const { setUser, clearUser, setLoading, updateUser } = useUserStore()
  const [showTrialExpired, setShowTrialExpired] = useState(false)

  const [fontsLoaded, fontError] = useFonts({
    Syne_600SemiBold,
    Syne_800ExtraBold,
    DMSans_300Light,
    DMSans_400Regular,
    DMSans_500Medium,
  })

  // Esconde o splash assim que as fontes estiverem prontas (ou falharem)
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync()
    }
  }, [fontsLoaded, fontError])

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

  return (
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
  )
}

const s = StyleSheet.create({ root: { flex: 1 } })
