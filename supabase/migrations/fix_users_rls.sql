-- ============================================================
-- Fix: RLS da tabela users + trigger de criação automática
--
-- PROBLEMA: após supabase.auth.signUp(), quando confirmação de
-- e-mail está ativa, não há sessão ainda. auth.uid() retorna null
-- e o INSERT na tabela users é bloqueado pelo RLS.
--
-- SOLUÇÃO: trigger SECURITY DEFINER em auth.users que cria a
-- linha em public.users com todos os dados do metadata.
-- O upsert posterior do app (quando há sessão) atualiza o que
-- faltar via a policy de UPDATE.
-- ============================================================

-- 1. Garantir RLS ativo na tabela users
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Limpar policies antigas para recriar de forma limpa
DROP POLICY IF EXISTS "users_select_own"  ON public.users;
DROP POLICY IF EXISTS "users_insert_own"  ON public.users;
DROP POLICY IF EXISTS "users_update_own"  ON public.users;
DROP POLICY IF EXISTS "users_delete_own"  ON public.users;
-- nomes alternativos comuns
DROP POLICY IF EXISTS "Enable read access for users"   ON public.users;
DROP POLICY IF EXISTS "Enable insert for users"        ON public.users;
DROP POLICY IF EXISTS "Enable update for users"        ON public.users;
DROP POLICY IF EXISTS "Users can view own profile"     ON public.users;
DROP POLICY IF EXISTS "Users can update own profile"   ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile"   ON public.users;

-- SELECT: usuário lê apenas o próprio perfil
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- INSERT: usuário insere apenas sua própria linha
-- (fallback para quando há sessão imediata — sem confirmação de e-mail)
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- UPDATE: usuário atualiza apenas o próprio perfil
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE
  USING      (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. Trigger SECURITY DEFINER para criar perfil ao cadastrar
-- ============================================================
-- Roda com privilégio de superuser, bypassando RLS.
-- Lê os dados do metadata passado no signUp (options.data).
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta JSONB := NEW.raw_user_meta_data;
BEGIN
  INSERT INTO public.users (
    id,
    email,
    name,
    gender,
    goal,
    profile,
    activity_level,
    height,
    weight,
    target_weight,
    age,
    restrictions,
    is_premium
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(meta->>'name',           split_part(NEW.email, '@', 1)),
    COALESCE(meta->>'gender',         'neu'),
    COALESCE(meta->>'goal',           'maintain'),
    COALESCE(meta->>'profile',        'escultura'),
    COALESCE(meta->>'activity_level', 'moderate'),
    COALESCE((meta->>'height')::INTEGER,          170),
    COALESCE((meta->>'weight')::NUMERIC(5,1),      70),
    COALESCE((meta->>'target_weight')::NUMERIC(5,1), 70),
    COALESCE((meta->>'age')::INTEGER,              25),
    COALESCE(meta->'restrictions',    '["Nenhuma"]'::JSONB),
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Garante que o trigger só existe uma vez
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================
-- FIM DA MIGRAÇÃO
-- Execute no Supabase SQL Editor (requer acesso de admin)
-- ============================================================
