import React, { useState, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, TextInput, Animated, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { Linking } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors, Spacing, Radius, PROFILES } from '@constants/index'
import { useUserStore } from '@store/index'
import { supabase } from '@services/supabase'

// A MÁGICA DO TYPESCRIPT RESOLVIDA: Usando o caminho relativo
import type { Goal, Gender, Profile, ActivityLevel, FitnessLevel, User } from '../types'
import { dbUserToUser } from '@utils/index'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useT } from '@/i18n/useT'

const { width } = Dimensions.get('window')

const GOALS: Array<{ id: Goal; emoji: string; titleKey: string; subKey: string }> = [
  { id: 'lose_weight',  emoji: '📉', titleKey: 'profile.goal_lose',              subKey: 'profile.goal_lose_sub'         },
  { id: 'gain_muscle',  emoji: '💪', titleKey: 'profile.goal_gain',              subKey: 'profile.goal_gain_sub'         },
  { id: 'maintain',     emoji: '❤️', titleKey: 'profile.goal_maintain',          subKey: 'profile.goal_maintain_sub'     },
  { id: 'performance',  emoji: '🏃', titleKey: 'profile.goal_performance_label', subKey: 'profile.goal_performance_sub'  },
]

const GENDERS: Array<{ id: Gender; emoji: string; titleKey: string; subKey: string }> = [
  { id: 'masc', emoji: '🙋',    titleKey: 'onboarding.gender_m',    subKey: 'onboarding.gender_masc_sub' },
  { id: 'fem',  emoji: '🙋‍♀️', titleKey: 'onboarding.gender_f',    subKey: 'onboarding.gender_fem_sub'  },
  { id: 'neu',  emoji: '🧑',    titleKey: 'onboarding.gender_neu',  subKey: 'onboarding.gender_neu_sub'  },
  { id: 'skip', emoji: '🤫',    titleKey: 'onboarding.gender_skip', subKey: 'onboarding.gender_skip_sub' },
]

const ACTIVITIES: Array<{ id: ActivityLevel; emoji: string; titleKey: string; subKey: string }> = [
  { id: 'sedentary', emoji: '🛋️', titleKey: 'profile.activity_sedentary',     subKey: 'onboarding.activity_sedentary_sub' },
  { id: 'light',     emoji: '🚶', titleKey: 'profile.activity_light',          subKey: 'onboarding.activity_light_sub'     },
  { id: 'moderate',  emoji: '🚴', titleKey: 'profile.activity_moderate_label', subKey: 'onboarding.activity_moderate_sub'  },
  { id: 'active',    emoji: '🏋️', titleKey: 'profile.activity_active',         subKey: 'onboarding.activity_active_sub'    },
]

const FITNESS_LEVELS: Array<{ id: FitnessLevel; emoji: string; titleKey: string; subKey: string }> = [
  { id: 'beginner',     emoji: '🌱', titleKey: 'profile.fitness_beginner_label',     subKey: 'profile.fitness_beginner_sub'     },
  { id: 'intermediate', emoji: '💪', titleKey: 'profile.fitness_intermediate_label', subKey: 'profile.fitness_intermediate_sub' },
  { id: 'advanced',     emoji: '🏆', titleKey: 'profile.fitness_advanced_label',     subKey: 'profile.fitness_advanced_sub'     },
]

const RESTRICTIONS = [
  'Vegetariano', 'Vegano', 'Sem glúten', 'Sem lactose',
  'Low carb', 'Diabético', 'Hipertensão', 'Nenhuma',
]

type FoodBudget   = 'economico' | 'moderado' | 'premium'
type CookingTime  = 'rapido' | 'moderado' | 'elaborado'

const FOOD_BUDGETS: Array<{ id: FoodBudget; emoji: string; titleKey: string; subKey: string }> = [
  { id: 'economico', emoji: '💰', titleKey: 'profile.budget_economico_label', subKey: 'profile.budget_economico_sub' },
  { id: 'moderado',  emoji: '🛒', titleKey: 'profile.budget_moderado_label',  subKey: 'profile.budget_moderado_sub'  },
  { id: 'premium',   emoji: '💎', titleKey: 'profile.budget_premium_label',   subKey: 'profile.budget_premium_sub'   },
]

const COOKING_TIMES: Array<{ id: CookingTime; emoji: string; titleKey: string; subKey: string }> = [
  { id: 'rapido',    emoji: '⏱️',  titleKey: 'profile.cooking_rapido_title',    subKey: 'profile.cooking_rapido_sub'    },
  { id: 'moderado',  emoji: '🍳',  titleKey: 'profile.cooking_moderado_title',  subKey: 'profile.cooking_moderado_sub'  },
  { id: 'elaborado', emoji: '👨‍🍳', titleKey: 'profile.cooking_elaborado_title', subKey: 'profile.cooking_elaborado_sub' },
]

export default function OnboardingScreen() {
  const { t } = useT()
  const insets = useSafeAreaInsets()
  const { completeOnboarding } = useUserStore()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [isLoginMode, setIsLoginMode] = useState(false)
  const progress = useRef(new Animated.Value(0)).current

  // Form state
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [goal, setGoal]         = useState<Goal>('lose_weight')
  const [gender, setGender]     = useState<Gender>('masc')
  const [profile, setProfile]   = useState<Profile>('escultura')
  const [height, setHeight]     = useState(170)
  const [weight, setWeight]     = useState(72)
  const [targetW, setTargetW]   = useState(65)
  const [age, setAge]           = useState(28)
  const [activity, setActivity]         = useState<ActivityLevel>('moderate')
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel>('beginner')
  const [restrictions, setRestrictions] = useState<string[]>([])
  const [lgpdAccepted, setLgpdAccepted] = useState(false)

  // Preferências alimentares (step 8)
  const [foodBudget,   setFoodBudget]   = useState<FoodBudget>('moderado')
  const [cookingTime,  setCookingTime]  = useState<CookingTime>('moderado')
  const [foodLikes,    setFoodLikes]    = useState('')
  const [foodDislikes, setFoodDislikes] = useState('')

  // Código de convite (trial)
  const [promoCode, setPromoCode] = useState('')

  const TOTAL_STEPS = 9

  // ─── Profile title/desc helpers ─────────────────────────────────────────
  const getProfileTitle = (id: string): string => ({
    escultura:  t('onboarding.profile_escultura_title' as any),
    vitalidade: t('onboarding.profile_vitalidade_title' as any),
    harmonia:   t('onboarding.profile_harmonia_title' as any),
  }[id] ?? id)

  const getProfileDesc = (id: string): string => ({
    escultura:  t('onboarding.profile_escultura_desc' as any),
    vitalidade: t('onboarding.profile_vitalidade_desc' as any),
    harmonia:   t('onboarding.profile_harmonia_desc' as any),
  }[id] ?? id)

  const animateProgress = (toStep: number) => {
    Animated.timing(progress, {
      toValue: toStep / TOTAL_STEPS,
      duration: 300,
      useNativeDriver: false,
    }).start()
  }

  const next = () => {
    if (step === 0 && !isLoginMode && !lgpdAccepted) {
      Alert.alert(
        t('onboarding.consent_required_title' as any),
        t('onboarding.consent_required_msg' as any),
      )
      return
    }
    const n = step + 1
    if (n >= TOTAL_STEPS) return finish()
    setStep(n)
    animateProgress(n)
  }

  const back = () => {
    if (step === 0) return
    const p = step - 1
    setStep(p)
    animateProgress(p)
  }

  const toggleRestriction = (r: string) => {
    if (r === 'Nenhuma') { setRestrictions(['Nenhuma']); return }
    setRestrictions((prev) => {
      const without = prev.filter((x) => x !== 'Nenhuma')
      return without.includes(r) ? without.filter((x) => x !== r) : [...without, r]
    })
  }

  // ─── LOGIN REAL NO SUPABASE ──────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(
        t('onboarding.fields_required_title' as any),
        t('onboarding.login_fields_msg' as any),
      )
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      })

      if (error) throw error

      const { data: dbUser, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single()

      if (dbError || !dbUser) throw new Error(t('onboarding.profile_load_error' as any))

      const userObj = dbUserToUser({
        ...dbUser,
        id:    data.user.id,
        email: email.trim(),
      })

      completeOnboarding(userObj)
      router.replace('/(tabs)/home')

    } catch (err: any) {
      Alert.alert(
        t('onboarding.login_error_title' as any),
        t('onboarding.login_error_msg' as any),
      )
    } finally {
      setLoading(false)
    }
  }

  // Valida senha forte localmente (mesmas regras do Supabase) com mensagem clara.
  // Retorna a chave i18n do primeiro erro, ou null se a senha for válida.
  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8)          return 'errors.password_too_short'
    if (!/[A-Z]/.test(pwd))      return 'errors.password_needs_upper'
    if (!/[a-z]/.test(pwd))      return 'errors.password_needs_lower'
    if (!/[0-9]/.test(pwd))      return 'errors.password_needs_digit'
    if (!/[^A-Za-z0-9]/.test(pwd)) return 'errors.password_needs_symbol'
    return null
  }

  // ─── CADASTRO REAL + GRAVAÇÃO NA TABELA USERS ────────────────────────────
  const finish = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert(
        t('onboarding.fields_required_title' as any),
        t('onboarding.register_fields_msg' as any),
      )
      setStep(0)
      animateProgress(0)
      return
    }

    // Validação de senha forte antes de chamar o Supabase (evita erro técnico em inglês)
    const pwdError = validatePassword(password.trim())
    if (pwdError) {
      Alert.alert(t('onboarding.fields_required_title' as any), t(pwdError as any))
      setStep(0)
      animateProgress(0)
      return
    }

    setLoading(true)
    try {
      const finalRestrictions = restrictions.length ? restrictions : ['Nenhuma']

      const { data, error } = await supabase.auth.signUp({
        email:    email.trim(),
        password: password.trim(),
        options: {
          data: {
            name:           name.trim(),
            gender,
            goal,
            profile,
            activity_level: activity,
            fitness_level:  fitnessLevel,
            height,
            weight,
            target_weight:  targetW,
            age,
            restrictions:   finalRestrictions,
          },
        },
      })

      if (error) throw error
      if (!data.user) throw new Error(t('onboarding.email_registered' as any))

      // Sem sessão = confirmação de e-mail habilitada no Supabase.
      // Desative em: Dashboard → Authentication → Providers → Email → "Confirm email"
      if (!data.session) {
        Alert.alert(
          t('onboarding.confirm_email_title' as any),
          t('onboarding.confirm_email_msg' as any, { email: email.trim() }),
        )
        return
      }

      // Grava diretamente na tabela public.users (não depende de trigger)
      const { error: dbError } = await supabase.from('users').upsert({
        id:             data.user.id,
        name:           name.trim(),
        email:          email.trim(),
        gender,
        goal,
        profile,
        activity_level: activity,
        fitness_level:  fitnessLevel,
        height,
        weight,
        target_weight:  targetW,
        age,
        restrictions:   finalRestrictions,
        food_budget:    foodBudget,
        food_likes:     foodLikes.trim(),
        food_dislikes:  foodDislikes.trim(),
        cooking_time:   cookingTime,
        is_premium:     false,
        created_at:     new Date().toISOString(),
      })
      if (dbError) throw dbError

      await AsyncStorage.removeItem('nutriai-user')

      // ─── Resgatar código de convite (se informado) ──────────────────
      let trialData: { isPremium: boolean; premiumPlan?: 'trial'; subscriptionType?: 'recurring' | 'one_time' | 'trial'; premiumExpiresAt?: string; promoCodeUsed?: string } = {
        isPremium: false,
      }

      if (promoCode.trim()) {
        const { data: promoResult } = await supabase.rpc('redeem_promo_code', {
          p_code:    promoCode.trim(),
          p_user_id: data.user.id,
        })
        if (promoResult?.success) {
          trialData = {
            isPremium:        true,
            premiumPlan:      'trial',
            subscriptionType: 'trial',
            premiumExpiresAt: promoResult.expires_at,
            promoCodeUsed:    promoCode.trim(),
          }
          Alert.alert(
            t('profile.trial_activated' as any),
            t('onboarding.trial_msg_long' as any, { days: promoResult.trial_days }),
            [{ text: t('onboarding.trial_ok_btn' as any) }]
          )
        } else {
          // Código inválido não impede o cadastro — apenas avisa
          Alert.alert(
            t('onboarding.promo_invalid_title' as any),
            promoResult?.error ?? t('onboarding.promo_invalid_msg' as any),
          )
        }
      }

      const userObj: User = {
        id:            data.user.id,
        name:          name.trim(),
        email:         email.trim(),
        gender,
        goal,
        profile,
        activityLevel: activity,
        fitnessLevel,
        height,
        weight,
        targetWeight:  targetW,
        age,
        restrictions:  finalRestrictions,
        foodBudget,
        foodLikes:     foodLikes.trim(),
        foodDislikes:  foodDislikes.trim(),
        cookingTime,
        createdAt:     new Date().toISOString(),
        ...trialData,
      }

      completeOnboarding(userObj)
      router.replace('/(tabs)/home')

    } catch (err: any) {
      // Traduz erros de senha do servidor (vêm em inglês) para mensagem amigável
      const raw = (err?.message ?? '').toLowerCase()
      let msg = err?.message || t('common.retry' as any)
      if (raw.includes('password') && (raw.includes('weak') || raw.includes('leaked') || raw.includes('pwned') || raw.includes('strength'))) {
        msg = t('errors.weak_password' as any)
      } else if (raw.includes('already') || raw.includes('registered')) {
        msg = t('onboarding.email_registered' as any)
      }
      Alert.alert(t('onboarding.register_error_title' as any), msg)
    } finally {
      setLoading(false)
    }
  }

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  })

  return (
    <View style={s.root}>
      <LinearGradient colors={[Colors.bg, Colors.bg2]} style={StyleSheet.absoluteFill} />

      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.logoRow}>
          <View style={s.logoMark}>
            <Text style={s.logoLeaf}>🌿</Text>
          </View>
          <Text style={s.logoText}>Nutri<Text style={{ color: Colors.accent }}>AI</Text></Text>
        </View>
        {!isLoginMode && (
          <View style={s.progressBar}>
            <Animated.View style={[s.progressFill, { width: progressWidth }]} />
          </View>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {step === 0 && (
          <View style={s.step}>
            <Text style={s.stepTitle}>
              {isLoginMode
                ? t('onboarding.welcome_login' as any)
                : t('onboarding.welcome_register' as any)}
            </Text>

            {!isLoginMode && (
              <View style={s.card}>
                <View style={s.featureRow}>
                  <Text style={s.featureEmoji}>📸</Text>
                  <Text style={s.featureText}>{t('onboarding.feature_photo' as any)}</Text>
                </View>
                <View style={s.featureRow}>
                  <Text style={s.featureEmoji}>🧠</Text>
                  <Text style={s.featureText}>{t('onboarding.feature_ai' as any)}</Text>
                </View>
              </View>
            )}

            {!isLoginMode && (
              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>{t('onboarding.full_name_label' as any)}</Text>
                <TextInput
                  style={s.input}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('onboarding.full_name_placeholder' as any)}
                  placeholderTextColor={Colors.text3}
                />
              </View>
            )}

            <View style={s.inputWrap}>
              <Text style={s.inputLabel}>{t('onboarding.email_input_label' as any)}</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder={t('onboarding.email_input_placeholder' as any)}
                placeholderTextColor={Colors.text3}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={s.inputWrap}>
              <Text style={s.inputLabel}>{t('onboarding.password_input_label' as any)}</Text>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                placeholder={t('onboarding.password_input_placeholder' as any)}
                placeholderTextColor={Colors.text3}
                secureTextEntry
              />
            </View>

            {!isLoginMode && (
              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>
                  {t('onboarding.promo_input_label' as any)}{' '}
                  <Text style={{ color: Colors.text3, fontWeight: '400' }}>
                    {t('onboarding.optional' as any)}
                  </Text>
                </Text>
                <TextInput
                  style={s.input}
                  value={promoCode}
                  onChangeText={(v) => setPromoCode(v.toUpperCase())}
                  placeholder={t('onboarding.promo_input_placeholder' as any)}
                  placeholderTextColor={Colors.text3}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
            )}

            {!isLoginMode && (
              <TouchableOpacity
                style={s.consentRow}
                onPress={() => setLgpdAccepted(!lgpdAccepted)}
                activeOpacity={0.7}
              >
                <View style={[s.consentBox, lgpdAccepted && s.consentBoxChecked]}>
                  {lgpdAccepted && <Text style={s.consentCheck}>✓</Text>}
                </View>
                <Text style={s.consentText}>
                  {t('onboarding.consent_read' as any)}{' '}
                  <Text style={s.consentLink} onPress={() => router.push('/legal/terms')}>
                    {t('onboarding.terms_link' as any)}
                  </Text>
                  {', '}
                  <Text style={s.consentLink} onPress={() => router.push('/legal/privacy')}>
                    {t('onboarding.privacy_link' as any)}
                  </Text>
                  {' '}{t('onboarding.and' as any)}{' '}
                  <Text style={s.consentLink} onPress={() => router.push('/legal/lgpd')}>
                    {t('onboarding.consent_lgpd_link' as any)}
                  </Text>
                  {t('onboarding.consent_health' as any)}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={s.toggleModeBtn}
              onPress={() => setIsLoginMode(!isLoginMode)}
            >
              <Text style={s.toggleModeText}>
                {isLoginMode
                  ? t('onboarding.toggle_no_account' as any)
                  : t('onboarding.toggle_has_account' as any)}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 1 && (
          <View style={s.step}>
            <Text style={s.stepTitle}>{t('onboarding.step_goal' as any)}</Text>
            {GOALS.map((g) => (
              <TouchableOpacity key={g.id} style={[s.optCard, goal === g.id && s.optCardSel]} onPress={() => setGoal(g.id)}>
                <Text style={s.optEmoji}>{g.emoji}</Text>
                <View style={s.optText}>
                  <Text style={s.optTitle}>{t(g.titleKey as any)}</Text>
                  <Text style={s.optSub}>{t(g.subKey as any)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 2 && (
          <View style={s.step}>
            <Text style={s.stepTitle}>{t('onboarding.step_gender' as any)}</Text>
            {GENDERS.map((g) => (
              <TouchableOpacity key={g.id} style={[s.optCard, gender === g.id && s.optCardSel]} onPress={() => setGender(g.id)}>
                <Text style={s.optEmoji}>{g.emoji}</Text>
                <View style={s.optText}>
                  <Text style={s.optTitle}>{t(g.titleKey as any)}</Text>
                  <Text style={s.optSub}>{t(g.subKey as any)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 3 && (
          <View style={s.step}>
            <Text style={s.stepTitle}>{t('onboarding.step_profile' as any)}</Text>
            {PROFILES.map((p) => (
              <TouchableOpacity key={p.id} style={[s.optCard, profile === p.id && s.optCardSel]} onPress={() => setProfile(p.id as Profile)}>
                <Text style={s.optEmoji}>{p.emoji}</Text>
                <View style={s.optText}>
                  <Text style={s.optTitle}>{getProfileTitle(p.id)}</Text>
                  <Text style={s.optSub}>{getProfileDesc(p.id)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 4 && (
          <View style={s.step}>
            <Text style={s.stepTitle}>{t('onboarding.step_body' as any)}</Text>
            {[
              { labelKey: 'onboarding.height_label',         value: height,  setter: setHeight,  min: 140, max: 220 },
              { labelKey: 'onboarding.weight_current_label', value: weight,  setter: setWeight,  min: 30,  max: 200 },
              { labelKey: 'onboarding.target_weight_label',  value: targetW, setter: setTargetW, min: 30,  max: 200 },
              { labelKey: 'onboarding.age_label',            value: age,     setter: setAge,     min: 12,  max: 100 },
            ].map((field) => (
              <View key={field.labelKey} style={s.sliderWrap}>
                <Text style={s.sliderLabel}>{t(field.labelKey as any)}</Text>
                <View style={s.numericRow}>
                  <TouchableOpacity style={s.numericBtn} onPress={() => field.setter((v) => Math.max(field.min, v - 1))}>
                    <Text style={s.numericBtnText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={s.numericInput}
                    value={String(field.value)}
                    onChangeText={(v) => {
                      const n = parseInt(v.replace(/[^0-9]/g, ''), 10)
                      if (!isNaN(n)) field.setter(Math.min(field.max, Math.max(field.min, n)))
                    }}
                    keyboardType="number-pad"
                    maxLength={3}
                    selectTextOnFocus
                    returnKeyType="done"
                  />
                  <TouchableOpacity style={s.numericBtn} onPress={() => field.setter((v) => Math.min(field.max, v + 1))}>
                    <Text style={s.numericBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {step === 5 && (
          <View style={s.step}>
            <Text style={s.stepTitle}>{t('onboarding.step_activity' as any)}</Text>
            {ACTIVITIES.map((a) => (
              <TouchableOpacity key={a.id} style={[s.optCard, activity === a.id && s.optCardSel]} onPress={() => setActivity(a.id)}>
                <Text style={s.optEmoji}>{a.emoji}</Text>
                <View style={s.optText}>
                  <Text style={s.optTitle}>{t(a.titleKey as any)}</Text>
                  <Text style={s.optSub}>{t(a.subKey as any)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 6 && (
          <View style={s.step}>
            <Text style={s.stepTitle}>{t('onboarding.step_fitness' as any)}</Text>
            <Text style={[s.optSub, { marginBottom: 4, fontSize: 13, color: Colors.text2 }]}>
              {t('onboarding.fitness_hint' as any)}
            </Text>
            {FITNESS_LEVELS.map((f) => (
              <TouchableOpacity key={f.id} style={[s.optCard, fitnessLevel === f.id && s.optCardSel]} onPress={() => setFitnessLevel(f.id)}>
                <Text style={s.optEmoji}>{f.emoji}</Text>
                <View style={s.optText}>
                  <Text style={s.optTitle}>{t(f.titleKey as any)}</Text>
                  <Text style={s.optSub}>{t(f.subKey as any)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 7 && (
          <View style={s.step}>
            <Text style={s.stepTitle}>{t('onboarding.step_restrictions' as any)}</Text>
            <View style={s.tagsWrap}>
              {RESTRICTIONS.map((r) => (
                <TouchableOpacity key={r} style={[s.tag, restrictions.includes(r) && s.tagSel]} onPress={() => toggleRestriction(r)}>
                  <Text style={[s.tagText, restrictions.includes(r) && s.tagTextSel]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === 8 && (
          <View style={s.step}>
            <Text style={s.stepTitle}>{t('onboarding.step_food' as any)}</Text>
            <Text style={s.prefSub}>
              {t('onboarding.step8_sub' as any)}
            </Text>

            <Text style={s.prefLabel}>{t('onboarding.budget_pref_label' as any)}</Text>
            {FOOD_BUDGETS.map((b) => (
              <TouchableOpacity key={b.id} style={[s.optCard, foodBudget === b.id && s.optCardSel]} onPress={() => setFoodBudget(b.id)}>
                <Text style={s.optEmoji}>{b.emoji}</Text>
                <View style={s.optText}>
                  <Text style={s.optTitle}>{t(b.titleKey as any)}</Text>
                  <Text style={s.optSub}>{t(b.subKey as any)}</Text>
                </View>
              </TouchableOpacity>
            ))}

            <Text style={[s.prefLabel, { marginTop: 8 }]}>{t('onboarding.cooking_pref_label' as any)}</Text>
            {COOKING_TIMES.map((c) => (
              <TouchableOpacity key={c.id} style={[s.optCard, cookingTime === c.id && s.optCardSel]} onPress={() => setCookingTime(c.id)}>
                <Text style={s.optEmoji}>{c.emoji}</Text>
                <View style={s.optText}>
                  <Text style={s.optTitle}>{t(c.titleKey as any)}</Text>
                  <Text style={s.optSub}>{t(c.subKey as any)}</Text>
                </View>
              </TouchableOpacity>
            ))}

            <Text style={[s.prefLabel, { marginTop: 8 }]}>
              {t('onboarding.likes_pref_label' as any)}{' '}
              <Text style={s.prefOptional}>{t('onboarding.optional' as any)}</Text>
            </Text>
            <TextInput
              style={[s.input, s.inputMulti]}
              value={foodLikes}
              onChangeText={setFoodLikes}
              placeholder={t('onboarding.likes_placeholder' as any)}
              placeholderTextColor={Colors.text3}
              multiline
              numberOfLines={3}
              maxLength={300}
            />

            <Text style={s.prefLabel}>
              {t('onboarding.dislikes_pref_label' as any)}{' '}
              <Text style={s.prefOptional}>{t('onboarding.optional' as any)}</Text>
            </Text>
            <TextInput
              style={[s.input, s.inputMulti]}
              value={foodDislikes}
              onChangeText={setFoodDislikes}
              placeholder={t('onboarding.dislikes_placeholder' as any)}
              placeholderTextColor={Colors.text3}
              multiline
              numberOfLines={3}
              maxLength={300}
            />
          </View>
        )}

      </ScrollView>
      </KeyboardAvoidingView>

      <View style={s.footer}>
        {step > 0 && !isLoginMode && (
          <TouchableOpacity style={s.btnBack} onPress={back} disabled={loading}>
            <Text style={s.btnBackText}>{t('common.back' as any)}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.btnNext, (step === 0 || isLoginMode) && { flex: 1 }, loading && { opacity: 0.7 }]}
          onPress={isLoginMode && step === 0 ? handleLogin : next}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color={Colors.bg} /> : (
            <Text style={s.btnNextText}>
              {isLoginMode && step === 0
                ? t('onboarding.btn_enter' as any)
                : step === TOTAL_STEPS - 1
                  ? t('onboarding.btn_finish' as any)
                  : t('common.continue' as any)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: Colors.bg },
  header:         { paddingHorizontal: Spacing[6], paddingBottom: Spacing[4] },
  logoRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  logoMark:       { width: 34, height: 34, borderRadius: 9, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  logoLeaf:       { fontSize: 18 },
  logoText:       { fontSize: 20, fontWeight: '800', color: Colors.text },
  progressBar:    { height: 3, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  progressFill:   { height: '100%', backgroundColor: Colors.accent, borderRadius: 2 },
  content:        { padding: Spacing[6], paddingBottom: 120 },
  step:           { gap: Spacing[3] },
  stepTitle:      { fontSize: 28, fontWeight: '800', color: Colors.text, lineHeight: 34 },
  card:           { backgroundColor: Colors.bg3, borderRadius: Radius.lg, padding: Spacing[4], gap: Spacing[3] },
  featureRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureEmoji:   { fontSize: 20 },
  featureText:    { fontSize: 13, color: Colors.text2, flex: 1 },
  inputWrap:      { marginTop: Spacing[1], marginBottom: 4 },
  inputLabel:     { fontSize: 12, color: Colors.text2, marginBottom: 6 },
  input:          { backgroundColor: Colors.bg3, borderRadius: Radius.md, padding: Spacing[4], fontSize: 16, color: Colors.text, borderWidth: 1, borderColor: Colors.border2 },
  toggleModeBtn:    { marginTop: 12, alignItems: 'center', paddingVertical: 10 },
  toggleModeText:   { color: Colors.accent, fontSize: 14, fontWeight: '600' },
  consentRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 16, paddingHorizontal: 2 },
  consentBox:       { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: Colors.border2, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  consentBoxChecked:{ borderColor: Colors.accent, backgroundColor: Colors.accent },
  consentCheck:     { fontSize: 12, color: Colors.bg, fontWeight: '800' },
  consentText:      { flex: 1, fontSize: 12, color: Colors.text2, lineHeight: 18 },
  consentLink:      { color: Colors.accent, textDecorationLine: 'underline', fontWeight: '600' },
  optCard:        { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg2 },
  optCardSel:     { borderColor: Colors.accent, backgroundColor: '#111800' },
  optEmoji:       { fontSize: 26 },
  optText:        { flex: 1 },
  optTitle:       { fontSize: 14, fontWeight: '600', color: Colors.text },
  optSub:         { fontSize: 12, color: Colors.text2, marginTop: 1 },
  sliderWrap:     { marginBottom: Spacing[3] },
  sliderLabel:    { fontSize: 13, color: Colors.text2, marginBottom: 8 },
  numericRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  numericBtn:     { width: 48, height: 52, backgroundColor: Colors.bg3, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  numericBtnText: { fontSize: 22, color: Colors.text, fontWeight: '500', lineHeight: 26 },
  numericInput:   { flex: 1, height: 52, backgroundColor: Colors.bg3, borderRadius: 10, borderWidth: 1, borderColor: Colors.accent, textAlign: 'center', fontSize: 24, fontWeight: '700', color: Colors.accent },
  tagsWrap:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag:            { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border2 },
  tagSel:         { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tagText:        { fontSize: 13, color: Colors.text2 },
  tagTextSel:     { color: Colors.bg, fontWeight: '600' },
  prefSub:        { fontSize: 13, color: Colors.text2, lineHeight: 18, marginBottom: 4 },
  prefLabel:      { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  prefOptional:   { fontWeight: '400', color: Colors.text3, fontSize: 12 },
  inputMulti:     { height: 80, textAlignVertical: 'top', paddingTop: 12 },
  footer:         { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 10, padding: Spacing[5], paddingBottom: 36, backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.border },
  btnBack:        { flex: 1, padding: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border2, alignItems: 'center', justifyContent: 'center' },
  btnBackText:    { fontSize: 14, fontWeight: '600', color: Colors.text2 },
  btnNext:        { flex: 2, padding: 14, borderRadius: Radius.md, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  btnNextText:    { fontSize: 15, fontWeight: '700', color: Colors.bg },
})
