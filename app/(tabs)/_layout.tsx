import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Platform, TouchableOpacity, StyleSheet, Text } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useT } from '@/i18n/useT'

const LIME = '#C8F060', GRAY = '#444440', BG = '#111111', BORDER = '#2A2A2A'
type IconName = React.ComponentProps<typeof Ionicons>['name']

// ─── Botão central de câmera ─────────────────────────────────────────────
function ScanTabButton({ onPress, accessibilityState, style }: any) {
  const focused = accessibilityState?.selected
  const { t } = useT()
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[style, styles.scanBtnWrap]}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={focused ? ['#E8FF80', '#C8F060'] : ['#C8F060', '#A8D040']}
        style={styles.scanBtn}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name="camera" size={26} color="#0A0A0A" />
      </LinearGradient>
      <Text style={[styles.scanLabel, focused && { color: LIME }]}>{t('tabs.camera')}</Text>
    </TouchableOpacity>
  )
}

type TabDef = {
  name: string; titleKey: string
  icon: IconName; iconFocused: IconName
  isCenter?: boolean
}

const TAB_DEFS: TabDef[] = [
  { name: 'home',    titleKey: 'tabs.home',    icon: 'home-outline',       iconFocused: 'home'       },
  { name: 'diet',    titleKey: 'tabs.diet',    icon: 'nutrition-outline',  iconFocused: 'nutrition'  },
  { name: 'scan',    titleKey: 'tabs.camera',  icon: 'camera-outline',     iconFocused: 'camera',     isCenter: true },
  { name: 'workout', titleKey: 'tabs.workout', icon: 'barbell-outline',    iconFocused: 'barbell'    },
  { name: 'profile', titleKey: 'tabs.profile', icon: 'person-outline',     iconFocused: 'person'     },
]

const HIDDEN = ['ranks','coach','coop','optimize','routine','subscription','report','feedback']

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  const { t } = useT()
  // paddingBottom dinâmico: respeita a barra de navegação do Android (soft buttons)
  const tabBarPaddingBottom = Platform.OS === 'ios' ? 24 : Math.max(insets.bottom, 8)
  const tabBarHeight = Platform.OS === 'ios' ? 88 : 56 + tabBarPaddingBottom

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor:  BG,
          borderTopColor:   BORDER,
          borderTopWidth:   1,
          height:           tabBarHeight,
          paddingBottom:    tabBarPaddingBottom,
          paddingTop:       8,
        },
        tabBarActiveTintColor:   LIME,
        tabBarInactiveTintColor: GRAY,
        tabBarLabelStyle: { fontSize: 9, fontWeight: '600', marginTop: 1 },
      }}
    >
      {TAB_DEFS.map(tab => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.titleKey),
            tabBarButton: tab.isCenter
              ? (props) => <ScanTabButton {...props} />
              : undefined,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? tab.iconFocused : tab.icon}
                size={size}
                color={color}
              />
            ),
          }}
        />
      ))}

      {/* A MÁGICA ACONTECE AQUI: href: null remove completamente a aba da barra inferior */}
      {HIDDEN.map(name => (
        <Tabs.Screen 
          key={name} 
          name={name} 
          options={{ href: null }} 
        />
      ))}
    </Tabs>
  )
}

const styles = StyleSheet.create({
  scanBtnWrap: {
    flex: 1, // Garante que a câmera vai ocupar a mesma largura que os outros botões
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Platform.OS === 'ios' ? -20 : -18,
  },
  scanBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C8F060',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  scanLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#C8F060',
    marginTop: 3,
  },
})