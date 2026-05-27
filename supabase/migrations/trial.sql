-- ============================================================
-- NutriAI — Sistema de Trial via Código Promocional
-- Execute no Supabase Dashboard → SQL Editor
-- https://supabase.com/dashboard/project/nrlspfndloqzodujnajp/sql/new
-- ============================================================

-- 1. Tabela de códigos promocionais
CREATE TABLE IF NOT EXISTS promo_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT        NOT NULL UNIQUE,
  description TEXT,
  trial_days  INT         NOT NULL DEFAULT 15,
  max_uses    INT         NOT NULL DEFAULT 1,
  used_count  INT         NOT NULL DEFAULT 0,
  valid_until TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Coluna no usuário para registrar qual código foi usado
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS promo_code_used TEXT;

-- 3. RLS — leitura pública de códigos ativos (o app precisa validar)
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promo_codes_select" ON promo_codes;
CREATE POLICY "promo_codes_select"
  ON promo_codes FOR SELECT
  USING (true);

-- Escrita apenas pelo service_role (Edge Functions / admin)
DROP POLICY IF EXISTS "promo_codes_service_write" ON promo_codes;
CREATE POLICY "promo_codes_service_write"
  ON promo_codes FOR ALL
  USING (auth.role() = 'service_role');

-- 4. Função atômica de resgate (SECURITY DEFINER para burlar RLS no UPDATE)
CREATE OR REPLACE FUNCTION redeem_promo_code(
  p_code    TEXT,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code        promo_codes%ROWTYPE;
  v_expires_at  TIMESTAMPTZ;
BEGIN
  -- Busca e bloqueia o registro para evitar race condition
  SELECT * INTO v_code
  FROM promo_codes
  WHERE code = UPPER(TRIM(p_code))
  FOR UPDATE;

  -- Código não encontrado
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Código inválido.');
  END IF;

  -- Código expirado por data
  IF v_code.valid_until IS NOT NULL AND v_code.valid_until < NOW() THEN
    RETURN json_build_object('success', false, 'error', 'Código expirado.');
  END IF;

  -- Limite de usos atingido
  IF v_code.used_count >= v_code.max_uses THEN
    RETURN json_build_object('success', false, 'error', 'Código esgotado.');
  END IF;

  -- Usuário já usou um código
  IF EXISTS (
    SELECT 1 FROM users WHERE id = p_user_id AND promo_code_used IS NOT NULL
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Você já usou um código promocional.');
  END IF;

  -- Usuário já é premium (não trial)
  IF EXISTS (
    SELECT 1 FROM users
    WHERE id = p_user_id
      AND is_premium = true
      AND (premium_plan IS DISTINCT FROM 'trial')
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Você já possui uma assinatura ativa.');
  END IF;

  -- Calcula data de expiração
  v_expires_at := NOW() + (v_code.trial_days || ' days')::INTERVAL;

  -- Incrementa contador de usos
  UPDATE promo_codes
  SET used_count = used_count + 1
  WHERE id = v_code.id;

  -- Ativa trial no usuário
  UPDATE users
  SET
    is_premium         = true,
    premium_plan       = 'trial',
    subscription_type  = 'trial',
    premium_expires_at = v_expires_at,
    promo_code_used    = UPPER(TRIM(p_code)),
    updated_at         = NOW()
  WHERE id = p_user_id;

  RETURN json_build_object(
    'success',          true,
    'trial_days',       v_code.trial_days,
    'expires_at',       v_expires_at,
    'promo_code_used',  UPPER(TRIM(p_code))
  );
END;
$$;

-- 5. Códigos iniciais
INSERT INTO promo_codes (code, description, trial_days, max_uses)
VALUES
  ('PIONEIRO',  'Usuários pioneiros do NutriAI',   15, 500),
  ('NUTRI15',   'Código geral de 15 dias',          15, 100),
  ('BETAUSER',  'Usuários beta',                    15,  50),
  ('CONVITE01', 'Primeiro lote de convites',        15,  30)
ON CONFLICT (code) DO NOTHING;

-- 6. Verificação final
SELECT
  (SELECT COUNT(*) FROM promo_codes)          AS total_codigos,
  (SELECT column_name FROM information_schema.columns
   WHERE table_name = 'users' AND column_name = 'promo_code_used') AS coluna_promo_code_used,
  (SELECT COUNT(*) FROM promo_codes WHERE code = 'PIONEIRO')       AS pioneiro_existe;
