import { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useUserStore } from '@store/index'
import { HomeSkeleton } from '@components/ui/Skeleton'

export default function IndexScreen() {
  const { user, isOnboarded, isLoading } = useUserStore()

  useEffect(() => {
    if (isLoading) return // Aguarda verificação de sessão
    const t = setTimeout(() => {
      if (isOnboarded && user) {
        router.replace('/(tabs)/home')
      } else {
        router.replace('/onboarding')
      }
    }, 100)
    return () => clearTimeout(t)
  }, [isLoading, isOnboarded, user])

  // Mostra skeleton enquanto verifica sessão
  return <HomeSkeleton />
}
