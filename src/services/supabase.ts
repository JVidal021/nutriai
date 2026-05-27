import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

// SecureStore tem limite de 2048 bytes por chave no iOS.
// O token de sessão do Supabase (JWT + refresh + metadata) excede esse limite.
// Solução: dividir valores grandes em chunks numerados.
const CHUNK_SIZE = 1900 // seguro abaixo do limite de 2048

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const numChunksStr = await SecureStore.getItemAsync(`${key}_numChunks`)
    if (!numChunksStr) return SecureStore.getItemAsync(key)
    const numChunks = parseInt(numChunksStr, 10)
    let value = ''
    for (let i = 0; i < numChunks; i++) {
      value += (await SecureStore.getItemAsync(`${key}_chunk_${i}`)) ?? ''
    }
    return value || null
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (value.length < CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value)
      return
    }
    const numChunks = Math.ceil(value.length / CHUNK_SIZE)
    await SecureStore.setItemAsync(`${key}_numChunks`, String(numChunks))
    for (let i = 0; i < numChunks; i++) {
      await SecureStore.setItemAsync(
        `${key}_chunk_${i}`,
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
      )
    }
  },

  removeItem: async (key: string): Promise<void> => {
    const numChunksStr = await SecureStore.getItemAsync(`${key}_numChunks`)
    if (numChunksStr) {
      const numChunks = parseInt(numChunksStr, 10)
      for (let i = 0; i < numChunks; i++) {
        await SecureStore.deleteItemAsync(`${key}_chunk_${i}`)
      }
      await SecureStore.deleteItemAsync(`${key}_numChunks`)
    }
    await SecureStore.deleteItemAsync(key)
  },
}

const supabaseUrl     = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'

if (__DEV__ && !process.env.EXPO_PUBLIC_SUPABASE_URL) {
  console.warn('[NutriAI] EXPO_PUBLIC_SUPABASE_URL não encontrado no .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage:            ExpoSecureStoreAdapter,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,
  },
})

export const auth = {
  signUp: async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } })
    if (error) throw error
    return data
  },
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },
  signOut:           () => supabase.auth.signOut(),
  getSession:        () => supabase.auth.getSession(),
  onAuthStateChange: (cb: Parameters<typeof supabase.auth.onAuthStateChange>[0]) =>
    supabase.auth.onAuthStateChange(cb),
}

export const db = {
  upsertUser:     (user: Record<string, unknown>) =>
    supabase.from('users').upsert(user).select().single(),
  getUser:        (userId: string) =>
    supabase.from('users').select('*').eq('id', userId).single(),
  logMeal:        (meal: Record<string, unknown>) =>
    supabase.from('meals').insert(meal).select().single(),
  getMealsForDay: (userId: string, date: string) =>
    supabase.from('meals').select('*').eq('user_id', userId)
      .gte('logged_at', `${date}T00:00:00`).lte('logged_at', `${date}T23:59:59`)
      .order('logged_at', { ascending: true }),
  logWorkout:     (workout: Record<string, unknown>) =>
    supabase.from('workouts').insert(workout).select().single(),
  upsertCheckin:  (checkin: Record<string, unknown>) =>
    supabase.from('checkins').upsert(checkin).select().single(),
  logWeight:      (userId: string, weight: number) =>
    supabase.from('weight_logs').insert({ user_id: userId, weight, logged_at: new Date().toISOString() }),
  findCoopByCode: (code: string) =>
    supabase.from('coop_links').select('*, users(*)').eq('code', code).single(),
  createCoopLink: (userId: string, code: string) =>
    supabase.from('coop_links').insert({ user_id: userId, code }).select().single(),
  getMyCoopCode: (userId: string) =>
    supabase.from('coop_links').select('code').eq('user_id', userId).maybeSingle(),
}

export const storage = {
  uploadMealPhoto: async (userId: string, uri: string): Promise<string> => {
    const fileName = `${userId}/${Date.now()}.jpg`
    const response = await fetch(uri)
    const blob     = await response.blob()
    const { data: uploadData, error } = await supabase.storage
      .from('meal-photos')
      .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false })
    if (error) throw new Error(`Falha no upload da foto: ${error.message}`)
    if (!uploadData?.path) throw new Error('Upload concluído sem retornar caminho do arquivo.')
    const { data } = supabase.storage.from('meal-photos').getPublicUrl(uploadData.path)
    return data.publicUrl
  },
}
