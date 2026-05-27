import React, { useEffect, useRef } from 'react'
import { Animated, View, StyleSheet, ViewStyle } from 'react-native'

interface SkeletonProps {
  width:    number | string
  height:   number
  radius?:  number
  style?:   ViewStyle
  opacity?: Animated.Value
}

export function Skeleton({ width, height, radius = 8, style, opacity: externalOpacity }: SkeletonProps) {
  const internalOpacity = useRef(new Animated.Value(0.3)).current
  const opacity = externalOpacity ?? internalOpacity

  useEffect(() => {
    if (externalOpacity) return // controlled externally by HomeSkeleton
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [opacity, externalOpacity])

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: '#2A2A2A', opacity }, style]}
    />
  )
}

// ─── Skeleton pré-montado para a Home ────────────────────────────────────────
// Usa um único Animated.Value compartilhado para evitar 12 animações nativas
// simultâneas que causam stack overflow no React Fabric (RN 0.81+).
export function HomeSkeleton() {
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [opacity])

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.row}>
        <View>
          <Skeleton width={100} height={14} opacity={opacity} style={{ marginBottom: 6 }} />
          <Skeleton width={160} height={24} opacity={opacity} />
        </View>
        <Skeleton width={36} height={36} radius={18} opacity={opacity} />
      </View>

      {/* Stats row */}
      <View style={[s.row, { gap: 8, marginTop: 16 }]}>
        {[0, 1, 2, 3].map(i => (
          <Skeleton key={i} width="23%" height={56} radius={12} opacity={opacity} />
        ))}
      </View>

      {/* Cards */}
      <Skeleton width="100%" height={130} opacity={opacity} style={{ marginTop: 12 }} />
      <View style={[s.row, { gap: 10, marginTop: 10 }]}>
        <Skeleton width="48%" height={110} opacity={opacity} />
        <Skeleton width="48%" height={110} opacity={opacity} />
      </View>
      <Skeleton width="100%" height={100} opacity={opacity} style={{ marginTop: 10 }} />
      <Skeleton width="100%" height={100} opacity={opacity} style={{ marginTop: 10 }} />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 20, backgroundColor: '#0A0A0A' },
  row:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
})
