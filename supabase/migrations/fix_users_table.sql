-- ============================================================
-- FIX: Cria tabela users completa + RLS + trigger segura
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. Cria a tabela public.users com TODAS as colunas necessárias
-- (IF NOT EXISTS é seguro — não sobrescreve dados existentes)
CREATE TABLE IF NOT EXISTS public.users (
  id                       UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name                     TEXT,
  email                    TEXT,
  gender                   TEXT        DEFAULT 'neu',
  goal                     TEXT        DEFAULT 'maintain',
  profile                  TEXT        DEFAULT 'escultura',
  activity_level           TEXT        DEFAULT 'moderate',
  height                   INTEGER     DEFAULT 170,
  weight                   NUMERIC(5,1) DEFAULT 70,
  target_weight            NUMERIC(5,1) DEFAULT 70,
  age                      INTEGER     DEFAULT 25,
  restrictions             JSONB       DEFAULT '[]',
  is_premium               BOOLEAN     DEFAULT FALSE,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW(),
  -- LGPD (schema.sql)
  consent_accepted         BOOLEAN     DEFAULT FALSE,
  consent_version          TEXT,
  consent_given_at         TIMESTAMPTZ,
  last_active_at           TIMESTAMPTZ DEFAULT NOW(),
  deletion_warning_sent_at TIMESTAMPTZ,
  -- Pagamentos (payments.sql)
  premium_plan             TEXT,
  premium_activated_at     TIMESTAMPTZ,
  premium_expires_at       TIMESTAMPTZ
);

-- 2. Adiciona colunas que podem estar faltando se a tabela já existia
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS goal                     TEXT        DEFAULT 'maintain',
  ADD COLUMN IF NOT EXISTS gender                   TEXT        DEFAULT 'neu',
  ADD COLUMN IF NOT EXISTS profile                  TEXT        DEFAULT 'escultura',
  ADD COLUMN IF NOT EXISTS activity_level           TEXT        DEFAULT 'moderate',
  ADD COLUMN IF NOT EXISTS height                   INTEGER     DEFAULT 170,
  ADD COLUMN IF NOT EXISTS weight                   NUMERIC(5,1) DEFAULT 70,
  ADD COLUMN IF NOT EXISTS target_weight            NUMERIC(5,1) DEFAULT 70,
  ADD COLUMN IF NOT EXISTS age                      INTEGER     DEFAULT 25,
  ADD COLUMN IF NOT EXISTS restrictions             JSONB       DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS is_premium               BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at               TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS consent_accepted         BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_version          TEXT,
  ADD COLUMN IF NOT EXISTS consent_given_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_active_at           TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deletion_warning_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS premium_plan             TEXT,
  ADD COLUMN IF NOT EXISTS premium_activated_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS premium_expires_at       TIMESTAMPTZ;

-- 3. Ativa RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS: usuário acessa apenas seu próprio row
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- 5. Trigger segura no auth.users
-- Cria um row mínimo quando o usuário faz signUp.
-- O app sobrescreve com upsert completo logo em seguida.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FIM
-- ============================================================
