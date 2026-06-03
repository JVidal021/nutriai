import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Colors, Spacing, Radius } from '@constants/index'
import { RANK_GRADIENTS, SHADOWS } from '@constants/theme'
import { useUserStore, useProgressStore } from '@store/index'
import { auth, db, supabase } from '@services/supabase'
import { calcBMI, getBMICategory } from '@utils/index'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useT, changeLanguage, getCurrentLanguage } from '@/i18n/useT'
import { scheduleDailyReminders } from '@services/notifications'
import type { AppLanguage } from '@/i18n/index'
import type { Goal, ActivityLevel, FitnessLevel } from '@/types/index'

// ─── Option arrays (use translation keys for display) ────────────────────────
const GOAL_OPTS: Array<{ id: Goal; emoji: string; titleKey: string; subKey: string }> = [
  { id: 'lose_weight', emoji: '📉', titleKey: 'profile.goal_lose',            subKey: 'profile.goal_lose_sub'            },
  { id: 'gain_muscle', emoji: '💪', titleKey: 'profile.goal_gain',            subKey: 'profile.goal_gain_sub'            },
  { id: 'maintain',    emoji: '❤️', titleKey: 'profile.goal_maintain',        subKey: 'profile.goal_maintain_sub'        },
  { id: 'performance', emoji: '🏃', titleKey: 'profile.goal_performance_label', subKey: 'profile.goal_performance_sub'  },
]

const ACTIVITY_OPTS: Array<{ id: ActivityLevel; emoji: string; titleKey: string }> = [
  { id: 'sedentary', emoji: '🛋️', titleKey: 'profile.activity_sedentary'       },
  { id: 'light',     emoji: '🚶', titleKey: 'profile.activity_light'            },
  { id: 'moderate',  emoji: '🚴', titleKey: 'profile.activity_moderate_label'   },
  { id: 'active',    emoji: '🏋️', titleKey: 'profile.activity_active'           },
]

const FITNESS_OPTS: Array<{ id: FitnessLevel; emoji: string; titleKey: string; subKey: string }> = [
  { id: 'beginner',     emoji: '🌱', titleKey: 'profile.fitness_beginner_label',     subKey: 'profile.fitness_beginner_sub'     },
  { id: 'intermediate', emoji: '💪', titleKey: 'profile.fitness_intermediate_label', subKey: 'profile.fitness_intermediate_sub' },
  { id: 'advanced',     emoji: '🏆', titleKey: 'profile.fitness_advanced_label',     subKey: 'profile.fitness_advanced_sub'     },
]

const BUDGET_OPTS: Array<{ id: string; emoji: string; titleKey: string; subKey: string }> = [
  { id: 'economico', emoji: '💰', titleKey: 'profile.budget_economico_label', subKey: 'profile.budget_economico_sub' },
  { id: 'moderado',  emoji: '🛒', titleKey: 'profile.budget_moderado_label',  subKey: 'profile.budget_moderado_sub'  },
  { id: 'premium',   emoji: '💎', titleKey: 'profile.budget_premium_label',   subKey: 'profile.budget_premium_sub'   },
]

const COOKING_OPTS: Array<{ id: string; emoji: string; titleKey: string; subKey: string }> = [
  { id: 'rapido',    emoji: '⏱️', titleKey: 'profile.cooking_rapido_title',    subKey: 'profile.cooking_rapido_sub'    },
  { id: 'moderado',  emoji: '🍳', titleKey: 'profile.cooking_moderado_title',  subKey: 'profile.cooking_moderado_sub'  },
  { id: 'elaborado', emoji: '👨‍🍳', titleKey: 'profile.cooking_elaborado_title', subKey: 'profile.cooking_elaborado_sub' },
]

// Internal restriction values — stay in PT because they're stored in the DB and sent to the AI
const RESTRICTIONS = ['Vegetariano','Vegano','Sem glúten','Sem lactose','Low carb','Diabético','Hipertensão','Nenhuma']

const DAYS_SHORT = ['S','T','Q','Q','S','S','D']
type EditModal = 'goal' | 'fitness' | 'food' | 'restrictions' | 'promo' | null

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const { t } = useT()
  const [language, setLanguage] = useState<AppLanguage>(getCurrentLanguage())
  const [weightModal, setWeightModal]         = useState(false)
  const [newWeight, setNewWeight]             = useState('')
  const [saving, setSaving]                   = useState(false)

  // ── Edit modal state ──────────────────────────────────────────────────────
  const [editModal, setEditModal]             = useState<EditModal>(null)
  const [editGoal, setEditGoal]               = useState<Goal>('maintain')
  const [editActivity, setEditActivity]       = useState<ActivityLevel>('moderate')
  const [editFitness, setEditFitness]         = useState<FitnessLevel>('beginner')
  const [editBudget, setEditBudget]           = useState('moderado')
  const [editCooking, setEditCooking]         = useState('moderado')
  const [editLikes, setEditLikes]             = useState('')
  const [editDislikes, setEditDislikes]       = useState('')
  const [editRestrictions, setEditRestrictions] = useState<string[]>([])
  const [promoInput, setPromoInput]             = useState('')
  const [redeeming, setRedeeming]               = useState(false)

  const { user, updateUser, clearUser, isLoading } = useUserStore()
  const { progress, xpHistory }         = useProgressStore()

  if (isLoading || !user) return null

  // ── Label helpers (use t() for proper language switching) ──────────────────
  const getGoalLabel = (goal: string) => {
    const map: Record<string, string> = {
      lose_weight: t('profile.goal_lose') + ' 📉',
      gain_muscle: t('profile.goal_gain') + ' 💪',
      maintain:    t('profile.goal_maintain') + ' ❤️',
      performance: t('profile.goal_performance_label') + ' 🏃',
    }
    return map[goal] ?? goal
  }
  const getActivityLabel = (a: string) => ({
    sedentary: t('profile.activity_sedentary'),
    light:     t('profile.activity_light'),
    moderate:  t('profile.activity_moderate_label'),
    active:    t('profile.activity_active'),
  } as Record<string, string>)[a] ?? a

  const getFitnessLabel = (f: string) => ({
    beginner:     t('profile.fitness_beginner_label')     + ' 🌱',
    intermediate: t('profile.fitness_intermediate_label') + ' 💪',
    advanced:     t('profile.fitness_advanced_label')     + ' 🏆',
  } as Record<string, string>)[f] ?? f

  const getBudgetLabel = (b: string) => ({
    economico: t('profile.budget_economico_label') + ' 💰',
    moderado:  t('profile.budget_moderado_label')  + ' 🛒',
    premium:   t('profile.budget_premium_label')   + ' 💎',
  } as Record<string, string>)[b] ?? b

  const getCookingLabel = (c: string) => ({
    rapido:    t('profile.cooking_rapido_short'),
    moderado:  t('profile.cooking_moderado_short'),
    elaborado: t('profile.cooking_elaborado_short'),
  } as Record<string, string>)[c] ?? c

  const translateBmiCat = (cat: string): string => ({
    'Abaixo do peso': t('profile.bmi_underweight'),
    'Peso normal':    t('profile.bmi_normal'),
    'Sobrepeso':      t('profile.bmi_overweight'),
    'Obesidade':      t('profile.bmi_obese'),
  } as Record<string, string>)[cat] ?? cat

  const bmi     = calcBMI(user.weight, user.height)
  const bmiCat  = getBMICategory(bmi)
  const rank    = progress.rank ?? { tier: 'bronze', emoji: '🥉', label: 'Bronze I' }
  const gradients = RANK_GRADIENTS[rank.tier] ?? ['#555','#333']

  // Streak da semana
  const today     = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay() + 1)
  const streakDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i)
    return d.toISOString().split('T')[0]
  })
  const activeDates = new Set(
    (xpHistory ?? []).filter(x => x?.date).map(x => x.date.split('T')[0])
  )

  // ── Abrir modal com valores atuais do usuário ─────────────────────────────
  const openEditModal = (modal: EditModal) => {
    if (modal === 'goal') {
      setEditGoal(user.goal)
      setEditActivity(user.activityLevel)
    } else if (modal === 'fitness') {
      setEditFitness(user.fitnessLevel)
    } else if (modal === 'food') {
      setEditBudget(user.foodBudget ?? 'moderado')
      setEditCooking(user.cookingTime ?? 'moderado')
      setEditLikes(user.foodLikes ?? '')
      setEditDislikes(user.foodDislikes ?? '')
    } else if (modal === 'restrictions') {
      setEditRestrictions([...(user.restrictions ?? [])])
    }
    setEditModal(modal)
  }

  // ── Salvar edições ────────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    setSaving(true)
    try {
      let dbFields: Record<string, unknown> = { id: user.id, updated_at: new Date().toISOString() }
      let storeFields: Partial<typeof user> = {}

      if (editModal === 'goal') {
        dbFields   = { ...dbFields, goal: editGoal, activity_level: editActivity }
        storeFields = { goal: editGoal, activityLevel: editActivity }
      } else if (editModal === 'fitness') {
        dbFields   = { ...dbFields, fitness_level: editFitness }
        storeFields = { fitnessLevel: editFitness }
      } else if (editModal === 'food') {
        dbFields = {
          ...dbFields,
          food_budget:   editBudget,
          cooking_time:  editCooking,
          food_likes:    editLikes.trim(),
          food_dislikes: editDislikes.trim(),
        }
        storeFields = {
          foodBudget:   editBudget as any,
          cookingTime:  editCooking as any,
          foodLikes:    editLikes.trim(),
          foodDislikes: editDislikes.trim(),
        }
      } else if (editModal === 'restrictions') {
        const final = editRestrictions.length ? editRestrictions : ['Nenhuma']
        dbFields   = { ...dbFields, restrictions: final }
        storeFields = { restrictions: final }
      }

      await db.upsertUser(dbFields)
      updateUser(storeFields)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setEditModal(null)
      Alert.alert(t('profile.profile_updated'), t('profile.profile_updated_msg'))
    } catch {
      Alert.alert(t('common.error'), t('common.retry'))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveWeight = async () => {
    const parsed = parseFloat(newWeight.replace(',', '.'))
    if (isNaN(parsed) || parsed < 30 || parsed > 300) {
      Alert.alert(t('profile.invalid_weight'), t('profile.weight_range_msg'))
      return
    }
    setSaving(true)
    try {
      await db.upsertUser({ id: user.id, weight: parsed, updated_at: new Date().toISOString() })
      await db.logWeight(user.id, parsed)
      updateUser({ weight: parsed })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setWeightModal(false)
      setNewWeight('')
      Alert.alert(t('profile.weight_saved'), t('profile.weight_saved_msg', { weight: parsed }))
    } catch { Alert.alert(t('common.error'), t('common.retry')) }
    finally { setSaving(false) }
  }

  const handleRedeemPromo = async () => {
    if (!promoInput.trim()) {
      Alert.alert(t('common.error'), t('profile.enter_promo'))
      return
    }
    setRedeeming(true)
    try {
      const { data: result } = await supabase.rpc('redeem_promo_code', {
        p_code:    promoInput.trim().toUpperCase(),
        p_user_id: user.id,
      })
      if (result?.success) {
        updateUser({
          isPremium:        true,
          premiumPlan:      'trial',
          subscriptionType: 'trial',
          premiumExpiresAt: result.expires_at,
          promoCodeUsed:    promoInput.trim().toUpperCase(),
        })
        setEditModal(null)
        setPromoInput('')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        Alert.alert(t('profile.trial_activated'), t('profile.trial_msg', { days: result.trial_days }))
      } else {
        Alert.alert(t('profile.promo_invalid'), result?.error ?? t('profile.promo_error_invalid'))
      }
    } catch {
      Alert.alert(t('common.error'), t('common.retry'))
    } finally {
      setRedeeming(false)
    }
  }

  const handleSignOut = () => {
    Alert.alert(t('profile.logout_confirm'), t('profile.logout_confirm_msg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.logout_btn'), style: 'destructive', onPress: async () => {
          await auth.signOut(); clearUser(); router.replace('/onboarding')
        }
      },
    ])
  }

  const toggleEditRestriction = (r: string) => {
    if (r === 'Nenhuma') { setEditRestrictions(['Nenhuma']); return }
    setEditRestrictions(prev => {
      const without = prev.filter(x => x !== 'Nenhuma')
      return without.includes(r) ? without.filter(x => x !== r) : [...without, r]
    })
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>

      {/* Header gradiente do rank */}
      <LinearGradient colors={[...gradients, '#0A0A0A']} style={s.profileHeader} start={{x:0,y:0}} end={{x:1,y:1}}>
        <LinearGradient colors={['rgba(255,255,255,0.15)','rgba(255,255,255,0.05)']} style={s.avatarWrap}>
          <Text style={s.avatarText}>{(user.name ?? '?').charAt(0).toUpperCase()}</Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1} ellipsizeMode="tail">{user.name}</Text>
          <Text style={s.email} numberOfLines={1} ellipsizeMode="tail">{user.email || t('profile.no_email')}</Text>
          <View style={s.badgeRow}>
            <View style={[s.rankBadge, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
              <Text style={s.rankBadgeText}>{rank.emoji} {rank.label}</Text>
            </View>
            {user.isPremium && (
              <View style={[s.premiumBadge, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
                <Text style={s.premiumBadgeText}>👑 Premium</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={s.totalXp}>{(progress.totalXp ?? 0).toLocaleString()}{'\n'}XP</Text>
      </LinearGradient>

      {/* Stats */}
      <View style={[s.card, SHADOWS.sm]}>
        <Text style={s.cardTitle}>{t('profile.general_progress')}</Text>
        <View style={s.statsGrid}>
          {[
            { label: t('profile.stat_kg_lost'),     val: `${(progress.weightLost ?? 0).toFixed(1)}`,     color: Colors.teal   },
            { label: t('profile.stat_active_days'), val: String(progress.activeDays ?? 0),                color: Colors.accent  },
            { label: t('profile.stat_adherence'),   val: `${progress.adherencePercent ?? 0}%`,            color: Colors.purple  },
            { label: t('profile.stat_workouts'),    val: String(progress.workoutsCompleted ?? 0),         color: Colors.orange  },
          ].map(stat => (
            <View key={stat.label} style={s.statBox}>
              <Text style={[s.statVal, { color: stat.color }]}>{stat.val}</Text>
              <Text style={s.statLbl}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Streak semanal */}
      <View style={[s.card, SHADOWS.sm]}>
        <Text style={s.cardTitle}>{t('profile.weekly_streak')}</Text>
        <View style={s.streakRow}>
          {streakDates.map((date, i) => {
            const isToday = date === today.toISOString().split('T')[0]
            const isDone  = activeDates.has(date) && !isToday
            if (isToday) return (
              <LinearGradient key={date} colors={['#C8F060','#A8D040']} style={s.streakDay}>
                <Text style={{ fontSize: 12 }}>🔥</Text>
                <Text style={[s.streakLabel, { color: '#0A0A0A', fontWeight: '700' }]}>{DAYS_SHORT[i]}</Text>
              </LinearGradient>
            )
            if (isDone) return (
              <View key={date} style={[s.streakDay, { backgroundColor: Colors.teal + '20', borderColor: Colors.teal + '50', borderWidth: 1 }]}>
                <Text style={{ fontSize: 12, color: Colors.teal }}>✓</Text>
                <Text style={[s.streakLabel, { color: Colors.teal }]}>{DAYS_SHORT[i]}</Text>
              </View>
            )
            return (
              <View key={date} style={s.streakDay}>
                <View style={{ width: 10, height: 10 }} />
                <Text style={s.streakLabel}>{DAYS_SHORT[i]}</Text>
              </View>
            )
          })}
        </View>
      </View>

      {/* Dados físicos */}
      <View style={[s.card, SHADOWS.sm]}>
        <View style={s.cardRowBetween}>
          <Text style={s.cardTitle}>{t('profile.physical_data')}</Text>
          <TouchableOpacity
            style={s.updateWeightBtn}
            onPress={() => { setNewWeight(String(user.weight)); setWeightModal(true) }}
          >
            <Text style={s.updateWeightText}>{t('profile.update_weight')}</Text>
          </TouchableOpacity>
        </View>
        {[
          { label: t('profile.weight'),        val: `${user.weight} kg` },
          { label: t('profile.target_weight'),  val: `${user.targetWeight} kg` },
          { label: t('profile.height'),         val: `${user.height} cm` },
          { label: t('profile.bmi'),            val: `${bmi} · ${translateBmiCat(bmiCat)}`, color: bmi < 25 ? Colors.teal : Colors.orange },
        ].map(item => (
          <View key={item.label} style={s.dataRow}>
            <Text style={s.dataLabel}>{item.label}</Text>
            <Text style={[s.dataVal, item.color ? { color: item.color } : {}]}>{item.val}</Text>
          </View>
        ))}
      </View>

      {/* ── Meu Plano (editável) ─────────────────────────────────────────── */}
      <View style={[s.card, SHADOWS.sm]}>
        <Text style={s.cardTitle}>{t('profile.my_plan')}</Text>
        <Text style={s.cardSub}>{t('profile.my_plan_sub')}</Text>

        {[
          {
            icon: '🎯',
            label: t('profile.goal'),
            val: `${getGoalLabel(user.goal)} · ${getActivityLabel(user.activityLevel)}`,
            modal: 'goal' as EditModal,
          },
          {
            icon: '🏋️',
            label: t('profile.gym_level'),
            val: getFitnessLabel(user.fitnessLevel),
            modal: 'fitness' as EditModal,
          },
          {
            icon: '🍽️',
            label: t('profile.food_prefs'),
            val: `${getBudgetLabel(user.foodBudget ?? 'moderado')} · ${getCookingLabel(user.cookingTime ?? 'moderado')}`,
            modal: 'food' as EditModal,
          },
          {
            icon: '🚫',
            label: t('profile.restrictions'),
            val: user.restrictions?.filter(r => r !== 'Nenhuma').join(', ') || t('profile.no_restrictions'),
            modal: 'restrictions' as EditModal,
            last: true,
          },
        ].map(item => (
          <View key={item.label} style={[s.planRow, item.last ? { borderBottomWidth: 0 } : {}]}>
            <Text style={s.planIcon}>{item.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.planLabel}>{item.label}</Text>
              <Text style={s.planVal} numberOfLines={2}>{item.val}</Text>
            </View>
            <TouchableOpacity style={s.editBtn} onPress={() => openEditModal(item.modal)}>
              <Text style={s.editBtnText}>{t('common.edit')}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Configurações */}
      <View style={[s.card, SHADOWS.sm]}>
        <Text style={s.cardTitle}>{t('settings.title')}</Text>

        {/* Seletor de idioma */}
        <View style={s.settingRow}>
          <Text style={s.settingLabel}>🌐 {t('profile.language')}</Text>
          <View style={s.langRow}>
            {(['pt', 'en'] as AppLanguage[]).map(lang => (
              <TouchableOpacity
                key={lang}
                style={[s.langBtn, language === lang && s.langBtnActive]}
                onPress={async () => {
                  setLanguage(lang)
                  await changeLanguage(lang)
                  // Reagenda lembretes no novo idioma
                  scheduleDailyReminders()
                }}
              >
                <Text style={[s.langBtnText, language === lang && s.langBtnTextActive]}>
                  {lang === 'pt' ? '🇧🇷 PT' : '🇺🇸 EN'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={s.settingRow} onPress={() => router.push('/profile/notifications' as any)}>
          <Text style={s.settingLabel}>🔔 {t('profile.notifications')}</Text>
          <Text style={s.settingArrow}>›</Text>
        </TouchableOpacity>
        {[
          { icon: '📊', labelKey: 'profile.report_btn',   route: '/(tabs)/report'        },
          { icon: '👑', labelKey: 'profile.subscription', route: '/(tabs)/subscription'  },
          { icon: '🤝', labelKey: 'profile.coop_mode',    route: '/(tabs)/coop'          },
        ].map(item => (
          <TouchableOpacity key={item.labelKey} style={s.settingRow} onPress={() => router.push(item.route as any)}>
            <Text style={s.settingLabel}>{item.icon} {t(item.labelKey as any)}</Text>
            <Text style={s.settingArrow}>›</Text>
          </TouchableOpacity>
        ))}
        {!user.isPremium && !user.promoCodeUsed && (
          <TouchableOpacity style={s.settingRow} onPress={() => { setPromoInput(''); setEditModal('promo') }}>
            <Text style={s.settingLabel}>🎁 {t('profile.redeem_code')}</Text>
            <Text style={s.settingArrow}>›</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[s.settingRow, { borderBottomWidth: 0 }]} onPress={() => router.push('/profile/delete-account')}>
          <Text style={[s.settingLabel, { color: Colors.red }]}>🗑️ {t('profile.delete_account')}</Text>
          <Text style={[s.settingArrow, { color: Colors.red }]}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
        <Text style={s.signOutText}>{t('profile.sign_out')}</Text>
      </TouchableOpacity>
      <Text style={s.version}>NutriAI v1.0.0 · suporte.nutriai@outlook.com</Text>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Objetivo + Atividade
      ════════════════════════════════════════════════════════════════════════ */}
      <Modal visible={editModal === 'goal'} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{t('profile.modal_goal_title')}</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              <Text style={s.modalSection}>{t('profile.modal_goal_section')}</Text>
              {GOAL_OPTS.map(g => (
                <TouchableOpacity key={g.id} style={[s.optCard, editGoal === g.id && s.optCardSel]} onPress={() => setEditGoal(g.id)}>
                  <Text style={s.optEmoji}>{g.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.optTitle}>{t(g.titleKey as any)}</Text>
                    <Text style={s.optSub}>{t(g.subKey as any)}</Text>
                  </View>
                </TouchableOpacity>
              ))}

              <Text style={[s.modalSection, { marginTop: 16 }]}>{t('profile.modal_activity_section')}</Text>
              {ACTIVITY_OPTS.map(a => (
                <TouchableOpacity key={a.id} style={[s.optCard, editActivity === a.id && s.optCardSel]} onPress={() => setEditActivity(a.id)}>
                  <Text style={s.optEmoji}>{a.emoji}</Text>
                  <Text style={[s.optTitle, { flex: 1 }]}>{t(a.titleKey as any)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setEditModal(null)}>
                <Text style={s.modalBtnCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtnSave, saving && { opacity: 0.6 }]} onPress={handleSaveEdit} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={Colors.bg} /> : <Text style={s.modalBtnSaveText}>{t('common.save')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Nível na academia
      ════════════════════════════════════════════════════════════════════════ */}
      <Modal visible={editModal === 'fitness'} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{t('profile.modal_fitness_title')}</Text>
            <Text style={s.modalSubtitle}>{t('profile.modal_fitness_sub')}</Text>

            {FITNESS_OPTS.map(f => (
              <TouchableOpacity key={f.id} style={[s.optCard, editFitness === f.id && s.optCardSel]} onPress={() => setEditFitness(f.id)}>
                <Text style={s.optEmoji}>{f.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.optTitle}>{t(f.titleKey as any)}</Text>
                  <Text style={s.optSub}>{t(f.subKey as any)}</Text>
                </View>
              </TouchableOpacity>
            ))}

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setEditModal(null)}>
                <Text style={s.modalBtnCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtnSave, saving && { opacity: 0.6 }]} onPress={handleSaveEdit} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={Colors.bg} /> : <Text style={s.modalBtnSaveText}>{t('common.save')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Preferências alimentares
      ════════════════════════════════════════════════════════════════════════ */}
      <Modal visible={editModal === 'food'} transparent animationType="slide">
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[s.modalSheet, { maxHeight: '90%' }]}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{t('profile.modal_food_title')}</Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={s.modalSection}>{t('profile.modal_budget_section')}</Text>
              {BUDGET_OPTS.map(b => (
                <TouchableOpacity key={b.id} style={[s.optCard, editBudget === b.id && s.optCardSel]} onPress={() => setEditBudget(b.id)}>
                  <Text style={s.optEmoji}>{b.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.optTitle}>{t(b.titleKey as any)}</Text>
                    <Text style={s.optSub}>{t(b.subKey as any)}</Text>
                  </View>
                </TouchableOpacity>
              ))}

              <Text style={[s.modalSection, { marginTop: 16 }]}>{t('profile.modal_cooking_section')}</Text>
              {COOKING_OPTS.map(c => (
                <TouchableOpacity key={c.id} style={[s.optCard, editCooking === c.id && s.optCardSel]} onPress={() => setEditCooking(c.id)}>
                  <Text style={s.optEmoji}>{c.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.optTitle}>{t(c.titleKey as any)}</Text>
                    <Text style={s.optSub}>{t(c.subKey as any)}</Text>
                  </View>
                </TouchableOpacity>
              ))}

              <Text style={[s.modalSection, { marginTop: 16 }]}>{t('profile.edit_food_prefs')}</Text>
              <TextInput
                style={[s.modalInput, { height: 72, textAlignVertical: 'top' }]}
                value={editLikes}
                onChangeText={setEditLikes}
                placeholder={t('profile.food_likes_placeholder')}
                placeholderTextColor={Colors.text3}
                multiline
                maxLength={300}
              />

              <Text style={[s.modalSection, { marginTop: 8 }]}>{t('profile.edit_food_dislikes')}</Text>
              <TextInput
                style={[s.modalInput, { height: 72, textAlignVertical: 'top', marginBottom: 16 }]}
                value={editDislikes}
                onChangeText={setEditDislikes}
                placeholder={t('profile.food_dislikes_placeholder')}
                placeholderTextColor={Colors.text3}
                multiline
                maxLength={300}
              />
            </ScrollView>

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setEditModal(null)}>
                <Text style={s.modalBtnCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtnSave, saving && { opacity: 0.6 }]} onPress={handleSaveEdit} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={Colors.bg} /> : <Text style={s.modalBtnSaveText}>{t('common.save')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Restrições alimentares
      ════════════════════════════════════════════════════════════════════════ */}
      <Modal visible={editModal === 'restrictions'} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{t('profile.modal_restrictions_title')}</Text>
            <Text style={s.modalSubtitle}>{t('profile.modal_restrictions_sub')}</Text>

            <View style={s.tagsWrap}>
              {RESTRICTIONS.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[s.tag, editRestrictions.includes(r) && s.tagSel]}
                  onPress={() => toggleEditRestriction(r)}
                >
                  <Text style={[s.tagText, editRestrictions.includes(r) && s.tagTextSel]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[s.modalBtns, { marginTop: 16 }]}>
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setEditModal(null)}>
                <Text style={s.modalBtnCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtnSave, saving && { opacity: 0.6 }]} onPress={handleSaveEdit} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={Colors.bg} /> : <Text style={s.modalBtnSaveText}>{t('common.save')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Código de convite
      ════════════════════════════════════════════════════════════════════════ */}
      <Modal visible={editModal === 'promo'} transparent animationType="slide">
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{t('profile.promo_title')}</Text>
            <Text style={s.modalSubtitle}>{t('profile.promo_sub')}</Text>
            <TextInput
              style={[s.modalInput, { fontSize: 20, fontWeight: '700', color: Colors.accent, textAlign: 'center', letterSpacing: 2 }]}
              value={promoInput}
              onChangeText={(v) => setPromoInput(v.toUpperCase())}
              placeholder={t('profile.promo_placeholder')}
              placeholderTextColor={Colors.text3}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
            />
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => { setEditModal(null); setPromoInput('') }}>
                <Text style={s.modalBtnCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtnSave, redeeming && { opacity: 0.6 }]} onPress={handleRedeemPromo} disabled={redeeming}>
                {redeeming ? <ActivityIndicator size="small" color={Colors.bg} /> : <Text style={s.modalBtnSaveText}>{t('profile.promo_redeem')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal de peso */}
      <Modal visible={weightModal} transparent animationType="slide">
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{t('profile.new_weight')}</Text>
            <Text style={s.modalSubtitle}>{t('profile.current_weight')} {user.weight} kg</Text>
            <TextInput
              style={[s.modalInput, { fontSize: 28, fontWeight: '700', color: Colors.accent, textAlign: 'center' }]}
              value={newWeight}
              onChangeText={setNewWeight}
              placeholder="Ex: 71.5"
              placeholderTextColor={Colors.text3}
              keyboardType="decimal-pad"
              autoFocus
            />
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => { setWeightModal(false); setNewWeight('') }}>
                <Text style={s.modalBtnCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtnSave, saving && { opacity: 0.6 }]} onPress={handleSaveWeight} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={Colors.bg} /> : <Text style={s.modalBtnSaveText}>{t('common.save')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </ScrollView>
  )
}

const s = StyleSheet.create({
  root:              { flex: 1, backgroundColor: Colors.bg },
  content:           { padding: Spacing[5], paddingBottom: 100 },
  profileHeader:     { flexDirection: 'row', gap: 14, alignItems: 'center', borderRadius: Radius.lg + 4, padding: 18, marginBottom: 12 },
  avatarWrap:        { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  avatarText:        { fontSize: 26, fontWeight: '800', color: '#FFF' },
  name:              { fontSize: 20, fontWeight: '800', color: '#FFF' },
  email:             { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  badgeRow:          { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  rankBadge:         { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  rankBadgeText:     { fontSize: 11, fontWeight: '600', color: '#FFF' },
  premiumBadge:      { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  premiumBadgeText:  { fontSize: 11, fontWeight: '600', color: Colors.gold },
  totalXp:           { fontSize: 16, fontWeight: '800', color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 20 },
  card:              { backgroundColor: Colors.bg2, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  cardTitle:         { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  cardSub:           { fontSize: 11, color: Colors.text3, marginBottom: 12, lineHeight: 16 },
  cardRowBetween:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statsGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statBox:           { width: '47%', backgroundColor: Colors.bg3, borderRadius: 10, padding: 12, alignItems: 'center' },
  statVal:           { fontSize: 20, fontWeight: '700' },
  statLbl:           { fontSize: 10, color: Colors.text2, marginTop: 2 },
  streakRow:         { flexDirection: 'row', gap: 5 },
  streakDay:         { flex: 1, aspectRatio: 1, borderRadius: 9, backgroundColor: Colors.bg3, alignItems: 'center', justifyContent: 'center', gap: 2 },
  streakLabel:       { fontSize: 9, color: Colors.text3 },
  dataRow:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dataLabel:         { fontSize: 13, color: Colors.text2 },
  dataVal:           { fontSize: 13, fontWeight: '600', color: Colors.text },
  updateWeightBtn:   { backgroundColor: Colors.accent + '15', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.accent + '40' },
  updateWeightText:  { fontSize: 11, fontWeight: '600', color: Colors.accent },
  // Meu Plano
  planRow:           { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.border },
  planIcon:          { fontSize: 18, width: 26, textAlign: 'center' },
  planLabel:         { fontSize: 11, color: Colors.text3, marginBottom: 2 },
  planVal:           { fontSize: 13, fontWeight: '600', color: Colors.text, lineHeight: 17 },
  editBtn:           { backgroundColor: Colors.accent + '15', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: Colors.accent + '30' },
  editBtnText:       { fontSize: 11, fontWeight: '700', color: Colors.accent },
  // Configurações
  settingRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.border },
  settingLabel:      { fontSize: 14, color: Colors.text },
  settingArrow:      { fontSize: 18, color: Colors.text3 },
  langRow:           { flexDirection: 'row', gap: 6 },
  langBtn:           { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  langBtnActive:     { backgroundColor: Colors.accent, borderColor: Colors.accent },
  langBtnText:       { fontSize: 12, fontWeight: '600', color: Colors.text3 },
  langBtnTextActive: { color: Colors.bg },
  signOutBtn:        { borderWidth: 1, borderColor: Colors.border2, borderRadius: Radius.md, padding: 14, alignItems: 'center', marginBottom: 12 },
  signOutText:       { fontSize: 14, fontWeight: '600', color: Colors.text2 },
  version:           { fontSize: 11, color: Colors.text3, textAlign: 'center', marginBottom: 8 },
  // Modais
  modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet:        { backgroundColor: Colors.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalHandle:       { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border2, alignSelf: 'center', marginBottom: 16 },
  modalTitle:        { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  modalSubtitle:     { fontSize: 13, color: Colors.text2, marginBottom: 16 },
  modalSection:      { fontSize: 12, fontWeight: '700', color: Colors.text, marginBottom: 8, marginTop: 4 },
  modalInput:        { backgroundColor: Colors.bg3, borderRadius: Radius.md, padding: 12, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border2, marginBottom: 4 },
  modalBtns:         { flexDirection: 'row', gap: 10, marginTop: 12 },
  modalBtnCancel:    { flex: 1, padding: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border2, alignItems: 'center' },
  modalBtnCancelText:{ fontSize: 14, fontWeight: '600', color: Colors.text2 },
  modalBtnSave:      { flex: 2, padding: 14, borderRadius: Radius.md, backgroundColor: Colors.accent, alignItems: 'center' },
  modalBtnSaveText:  { fontSize: 14, fontWeight: '700', color: Colors.bg },
  // Opt cards nos modais
  optCard:           { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg3, marginBottom: 6 },
  optCardSel:        { borderColor: Colors.accent, backgroundColor: '#111800' },
  optEmoji:          { fontSize: 22 },
  optTitle:          { fontSize: 13, fontWeight: '600', color: Colors.text },
  optSub:            { fontSize: 11, color: Colors.text2, marginTop: 1 },
  tagsWrap:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  tag:               { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border2 },
  tagSel:            { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tagText:           { fontSize: 13, color: Colors.text2 },
  tagTextSel:        { color: Colors.bg, fontWeight: '600' },
})
