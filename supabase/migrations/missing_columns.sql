-- ============================================================
-- NutriAI — Colunas faltantes
-- Execute no Supabase Dashboard → SQL Editor
-- https://supabase.com/dashboard/project/nrlspfndloqzodujnajp/sql/new
-- ============================================================

-- Colunas de assinatura Premium (usadas por set-premium e cancel-subscription)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_type    TEXT,         -- 'recurring' | 'one_time'
  ADD COLUMN IF NOT EXISTS mp_subscription_id   TEXT,         -- ID do preapproval mensal no MP
  ADD COLUMN IF NOT EXISTS premium_cancelled_at TIMESTAMPTZ;  -- data do cancelamento

-- Índice para buscar usuário pelo preapproval_id (usado na renovação mensal)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_mp_subscription
  ON users(mp_subscription_id)
  WHERE mp_subscription_id IS NOT NULL;

-- Nível de fitness (coluna ausente do schema inicial)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS fitness_level TEXT DEFAULT 'beginner';

-- Preferências alimentares (usadas no onboarding e na geração de plano)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS food_budget   TEXT DEFAULT 'moderado',  -- 'economico' | 'moderado' | 'premium'
  ADD COLUMN IF NOT EXISTS food_likes    TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS food_dislikes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS cooking_time  TEXT DEFAULT 'moderado';  -- 'rapido' | 'moderado' | 'elaborado'

-- Verificação: confirma que todas as colunas existem
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN (
    'subscription_type', 'mp_subscription_id', 'premium_cancelled_at',
    'fitness_level',
    'food_budget', 'food_likes', 'food_dislikes', 'cooking_time'
  )
ORDER BY column_name;
