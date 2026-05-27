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

const { width } = Dimensions.get('window')

const GOALS: Array<{ id: Goal; emoji: string; title: string; sub: string }> = [
  { id: 'lose_weight',   emoji: '📉', title: 'Perder peso',        sub: 'Déficit calórico inteligente'   },
  { id: 'gain_muscle',   emoji: '💪', title: 'Ganhar massa',        sub: 'Superávit + treino de força'    },
  { id: 'maintain',      emoji: '❤️', title: 'Manter saúde',        sub: 'Equilíbrio e bem-estar'         },
  { id: 'performance',   emoji: '🏃', title: 'Melhorar performance', sub: 'Foco em esporte e resistência' },
]

const GENDERS: Array<{ id: Gender; emoji: string; title: string; sub: string }> = [
  { id: 'masc', emoji: '🙋',    title: 'Masculino',          sub: 'O app vai se referir a você no masculino'   },
  { id: 'fem',  emoji: '🙋‍♀️', title: 'Feminino',           sub: 'O app vai se referir a você no feminino'    },
  { id: 'neu',  emoji: '🧑',    title: 'Neutro / Não-binário',sub: 'O app vai usar linguagem neutra e inclusiva'},
  { id: 'skip', emoji: '🤫',    title: 'Prefiro não informar', sub: 'Tudo bem — usaremos linguagem neutra'      },
]

const ACTIVITIES: Array<{ id: ActivityLevel; emoji: string; title: string; sub: string }> = [
  { id: 'sedentary', emoji: '🛋️', title: 'Sedentário',         sub: 'Pouco ou nenhum exercício'       },
  { id: 'light',     emoji: '🚶', title: 'Levemente ativo',    sub: '1–3 vezes por semana'             },
  { id: 'moderate',  emoji: '🚴', title: 'Moderadamente ativo',sub: '3–5 vezes por semana'             },
  { id: 'active',    emoji: '🏋️', title: 'Muito ativo',        sub: '6–7 vezes por semana'             },
]

const FITNESS_LEVELS: Array<{ id: FitnessLevel; emoji: string; title: string; sub: string }> = [
  { id: 'beginner',     emoji: '🌱', title: 'Iniciante',      sub: 'Começando agora ou menos de 6 meses de treino'   },
  { id: 'intermediate', emoji: '💪', title: 'Intermediário',   sub: 'Entre 6 meses e 2 anos de treino regular'        },
  { id: 'advanced',     emoji: '🏆', title: 'Avançado',        sub: 'Mais de 2 anos, treino consistente e progressivo' },
]

const RESTRICTIONS = [
  'Vegetariano', 'Vegano', 'Sem glúten', 'Sem lactose',
  'Low carb', 'Diabético', 'Hipertensão', 'Nenhuma',
]

type FoodBudget   = 'economico' | 'moderado' | 'premium'
type CookingTime  = 'rapido' | 'moderado' | 'elaborado'

const FOOD_BUDGETS: Array<{ id: FoodBudget; emoji: string; title: string; sub: string }> = [
  { id: 'economico', emoji: '💰', title: 'Econômico',      sub: 'Arroz, feijão, frango, ovos — pratos simples e acessíveis'         },
  { id: 'moderado',  emoji: '🛒', title: 'Moderado',       sub: 'Ingredientes variados sem exageros — boa variedade no dia a dia'    },
  { id: 'premium',   emoji: '💎', title: 'Sem restrição',  sub: 'Qualquer ingrediente — carnes nobres, suplementos e importados'     },
]

const COOKING_TIMES: Array<{ id: CookingTime; emoji: string; title: string; sub: string }> = [
  { id: 'rapido',    emoji: '⏱️', title: 'Rápido (< 20 min)', sub: 'Receitas práticas — fritadeira air fryer, micro-ondas, simples' },
  { id: 'moderado',  emoji: '🍳', title: 'Normal (20–40 min)', sub: 'Equilíbrio entre praticidade e variedade de sabores'           },
  { id: 'elaborado', emoji: '👨‍🍳', title: 'Gosto de cozinhar', sub: 'Receitas elaboradas são bem-vindas — tempo disponível'         },
]

export default function OnboardingScreen() {
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

  const animateProgress = (toStep: number) => {
    Animated.timing(progress, {
      toValue: toStep / TOTAL_STEPS,
      duration: 300,
      useNativeDriver: false,
    }).start()
  }

  const next = () => {
    if (step === 0 && !isLoginMode && !lgpdAccepted) {
      Alert.alert('Consentimento necessário', 'Para criar sua conta, aceite os Termos de Uso e a Política de Privacidade.')
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
      Alert.alert('Ops', 'E-mail e senha são obrigatórios.')
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

      if (dbError || !dbUser) throw new Error('Não foi possível carregar seu perfil. Tente novamente.')

      const userObj = dbUserToUser({
        ...dbUser,
        id:    data.user.id,
        email: email.trim(),
      })

      completeOnboarding(userObj)
      router.replace('/(tabs)/home')

    } catch (err: any) {
      Alert.alert('Erro no login', 'E-mail ou senha incorretos.')
    } finally {
      setLoading(false)
    }
  }

  // ─── CADASTRO REAL + GRAVAÇÃO NA TABELA USERS ────────────────────────────
  const finish = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Ops', 'Nome, e-mail e senha são obrigatórios.')
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
      if (!data.user) throw new Error('Este e-mail já está cadastrado. Use a opção de login.')

      // Sem sessão = confirmação de e-mail habilitada no Supabase.
      // Desative em: Dashboard → Authentication → Providers → Email → "Confirm email"
      if (!data.session) {
        Alert.alert(
          'Confirme seu e-mail',
          `Enviamos um link de confirmação para ${email.trim()}. Confirme e faça login.`,
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
      let trialData: { isPremium: boolean; premiumPlan?: 'trial'; premiumExpiresAt?: string; promoCodeUsed?: string } = {
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
            '🎁 Trial ativado!',
            `Seu período de teste Premium de ${promoResult.trial_days} dias começou. Aproveite todos os recursos!`,
            [{ text: 'Boa! 🚀' }]
          )
        } else {
          // Código inválido não impede o cadastro — apenas avisa
          Alert.alert('Código inválido', promoResult?.error ?? 'Código não reconhecido. Você pode adicionar um código válido depois.')
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
      Alert.alert('Erro no cadastro', err.message || 'Tente novamente.')
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
              {isLoginMode ? 'Bem-vindo\nde volta! 🌿' : 'Bem-vindo ao\nNutriAI 🌿'}
            </Text>
            
            {!isLoginMode && (
              <View style={s.card}>
                <View style={s.featureRow}>
                  <Text style={s.featureEmoji}>📸</Text>
                  <Text style={s.featureText}>Analise pratos e macros por foto</Text>
                </View>
                <View style={s.featureRow}>
                  <Text style={s.featureEmoji}>🧠</Text>
                  <Text style={s.featureText}>Dieta e treino gerados por IA</Text>
                </View>
              </View>
            )}

            {!isLoginMode && (
              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>Nome completo</Text>
                <TextInput
                  style={s.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Seu nome"
                  placeholderTextColor={Colors.text3}
                />
              </View>
            )}

            <View style={s.inputWrap}>
              <Text style={s.inputLabel}>Seu e-mail</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="exemplo@email.com"
                placeholderTextColor={Colors.text3}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={s.inputWrap}>
              <Text style={s.inputLabel}>Senha</Text>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={Colors.text3}
                secureTextEntry
              />
            </View>

            {!isLoginMode && (
              <View style={s.inputWrap}>
                <Text style={s.inputLabel}>
                  🎁 Código de convite <Text style={{ color: Colors.text3, fontWeight: '400' }}>(opcional)</Text>
                </Text>
                <TextInput
                  style={s.input}
                  value={promoCode}
                  onChangeText={(t) => setPromoCode(t.toUpperCase())}
                  placeholder="Ex: NUTRI15"
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
                  Li e concordo com os{' '}
                  <Text style={s.consentLink} onPress={() => router.push('/legal/terms')}>Termos de Uso</Text>
                  {', '}
                  <Text style={s.consentLink} onPress={() => router.push('/legal/privacy')}>Política de Privacidade</Text>
                  {' e '}
                  <Text style={s.consentLink} onPress={() => router.push('/legal/lgpd')}>Aviso LGPD</Text>
                  {', incluindo o tratamento dos meus dados de saúde.'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={s.toggleModeBtn}
              onPress={() => setIsLoginMode(!isLoginMode)}
            >
              <Text style={s.toggleModeText}>
                {isLoginMode ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Entrar'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 1 && (
          <View style={s.step}>
            <Text style={s.stepTitle}>Qual é{'\n'}seu objetivo?</Text>
            {GOALS.map((g) => (
              <TouchableOpacity key={g.id} style={[s.optCard, goal === g.id && s.optCardSel]} onPress={() => setGoal(g.id)}>
                <Text style={s.optEmoji}>{g.emoji}</Text>
                <View style={s.optText}><Text style={s.optTitle}>{g.title}</Text><Text style={s.optSub}>{g.sub}</Text></View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 2 && (
          <View style={s.step}>
            <Text style={s.stepTitle}>Como prefere{'\n'}ser chamade?</Text>
            {GENDERS.map((g) => (
              <TouchableOpacity key={g.id} style={[s.optCard, gender === g.id && s.optCardSel]} onPress={() => setGender(g.id)}>
                <Text style={s.optEmoji}>{g.emoji}</Text>
                <View style={s.optText}><Text style={s.optTitle}>{g.title}</Text><Text style={s.optSub}>{g.sub}</Text></View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 3 && (
          <View style={s.step}>
            <Text style={s.stepTitle}>Escolha{'\n'}seu perfil</Text>
            {PROFILES.map((p) => (
              <TouchableOpacity key={p.id} style={[s.optCard, profile === p.id && s.optCardSel]} onPress={() => setProfile(p.id as Profile)}>
                <Text style={s.optEmoji}>{p.emoji}</Text>
                <View style={s.optText}><Text style={s.optTitle}>{p.title}</Text><Text style={s.optSub}>{p.description}</Text></View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 4 && (
          <View style={s.step}>
            <Text style={s.stepTitle}>Seus dados{'\n'}físicos</Text>
            {[
              { label: 'Altura (cm)', value: height, setter: setHeight, min: 140, max: 220 },
              { label: 'Peso atual (kg)', value: weight, setter: setWeight, min: 30, max: 200 },
              { label: 'Peso meta (kg)', value: targetW, setter: setTargetW, min: 30, max: 200 },
              { label: 'Idade', value: age, setter: setAge, min: 12, max: 100 },
            ].map((field) => (
              <View key={field.label} style={s.sliderWrap}>
                <View style={s.sliderHeader}>
                  <Text style={s.sliderLabel}>{field.label}</Text>
                  <Text style={s.sliderValue}>{field.value}</Text>
                </View>
                <View style={s.sliderBtns}>
                  <TouchableOpacity style={s.sliderBtn} onPress={() => field.setter((v) => Math.max(field.min, v - 1))}>
                    <Text style={s.sliderBtnText}>−</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.sliderBtn} onPress={() => field.setter((v) => Math.min(field.max, v + 1))}>
                    <Text style={s.sliderBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {step === 5 && (
          <View style={s.step}>
            <Text style={s.stepTitle}>Nível de{'\n'}atividade</Text>
            {ACTIVITIES.map((a) => (
              <TouchableOpacity key={a.id} style={[s.optCard, activity === a.id && s.optCardSel]} onPress={() => setActivity(a.id)}>
                <Text style={s.optEmoji}>{a.emoji}</Text>
                <View style={s.optText}><Text style={s.optTitle}>{a.title}</Text><Text style={s.optSub}>{a.sub}</Text></View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 6 && (
          <View style={s.step}>
            <Text style={s.stepTitle}>Experiência{'\n'}na academia?</Text>
            <Text style={[s.optSub, { marginBottom: 4, fontSize: 13, color: Colors.text2 }]}>
              Isso define a complexidade e o volume dos seus treinos gerados por IA.
            </Text>
            {FITNESS_LEVELS.map((f) => (
              <TouchableOpacity key={f.id} style={[s.optCard, fitnessLevel === f.id && s.optCardSel]} onPress={() => setFitnessLevel(f.id)}>
                <Text style={s.optEmoji}>{f.emoji}</Text>
                <View style={s.optText}><Text style={s.optTitle}>{f.title}</Text><Text style={s.optSub}>{f.sub}</Text></View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 7 && (
          <View style={s.step}>
            <Text style={s.stepTitle}>Restrições{'\n'}alimentares?</Text>
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
            <Text style={s.stepTitle}>Sua realidade{'\n'}alimentar 🍽️</Text>
            <Text style={s.prefSub}>
              A IA vai criar um plano que você realmente consegue comprar e preparar.
            </Text>

            <Text style={s.prefLabel}>💰 Orçamento para alimentação</Text>
            {FOOD_BUDGETS.map((b) => (
              <TouchableOpacity key={b.id} style={[s.optCard, foodBudget === b.id && s.optCardSel]} onPress={() => setFoodBudget(b.id)}>
                <Text style={s.optEmoji}>{b.emoji}</Text>
                <View style={s.optText}><Text style={s.optTitle}>{b.title}</Text><Text style={s.optSub}>{b.sub}</Text></View>
              </TouchableOpacity>
            ))}

            <Text style={[s.prefLabel, { marginTop: 8 }]}>⏱️ Tempo disponível para cozinhar</Text>
            {COOKING_TIMES.map((c) => (
              <TouchableOpacity key={c.id} style={[s.optCard, cookingTime === c.id && s.optCardSel]} onPress={() => setCookingTime(c.id)}>
                <Text style={s.optEmoji}>{c.emoji}</Text>
                <View style={s.optText}><Text style={s.optTitle}>{c.title}</Text><Text style={s.optSub}>{c.sub}</Text></View>
              </TouchableOpacity>
            ))}

            <Text style={[s.prefLabel, { marginTop: 8 }]}>😋 O que você gosta ou costuma comer? <Text style={s.prefOptional}>(opcional)</Text></Text>
            <TextInput
              style={[s.input, s.inputMulti]}
              value={foodLikes}
              onChangeText={setFoodLikes}
              placeholder="Ex: frango grelhado, arroz com feijão, omelete, banana..."
              placeholderTextColor={Colors.text3}
              multiline
              numberOfLines={3}
              maxLength={300}
            />

            <Text style={s.prefLabel}>🚫 O que evita ou não gosta? <Text style={s.prefOptional}>(opcional)</Text></Text>
            <TextInput
              style={[s.input, s.inputMulti]}
              value={foodDislikes}
              onChangeText={setFoodDislikes}
              placeholder="Ex: fígado, chuchu, peixe, comida muito temperada..."
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
            <Text style={s.btnBackText}>Voltar</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.btnNext, (step === 0 || isLoginMode) && { flex: 1 }, loading && { opacity: 0.7 }]}
          onPress={isLoginMode && step === 0 ? handleLogin : next}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color={Colors.bg} /> : (
            <Text style={s.btnNextText}>
              {isLoginMode && step === 0 ? 'Entrar' : (step === TOTAL_STEPS - 1 ? 'Ver meu plano ✨' : 'Continuar')}
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
  sliderWrap:     { marginBottom: Spacing[2] },
  sliderHeader:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  sliderLabel:    { fontSize: 13, color: Colors.text2 },
  sliderValue:    { fontSize: 16, fontWeight: '700', color: Colors.accent },
  sliderBtns:     { flexDirection: 'row', gap: 8 },
  sliderBtn:      { flex: 1, backgroundColor: Colors.bg3, borderRadius: 8, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  sliderBtnText:  { fontSize: 18, color: Colors.text, fontWeight: '600' },
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