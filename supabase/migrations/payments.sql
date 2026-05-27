-- ============================================================
-- NutriAI — Migration: tabelas de pagamento
-- Execute no Supabase SQL Editor
-- ============================================================

-- ─── Campos premium na tabela users ──────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS premium_plan          TEXT,
  ADD COLUMN IF NOT EXISTS premium_activated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS premium_expires_at    TIMESTAMPTZ;

-- ─── Tabela de pagamentos (auditoria + idempotência) ─────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mp_payment_id  TEXT UNIQUE NOT NULL,    -- ID do Mercado Pago (idempotência)
  plan           TEXT NOT NULL,           -- 'monthly' ou 'annual'
  amount         DECIMAL(10,2) NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'BRL',
  status         TEXT NOT NULL,           -- 'approved', 'pending', 'rejected'
  paid_at        TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: usuário vê apenas seus próprios pagamentos
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_own" ON payments;
CREATE POLICY "payments_own" ON payments
  USING (auth.uid() = user_id);

-- service_role pode inserir (webhook)
CREATE POLICY "payments_service_insert" ON payments
  FOR INSERT WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_payments_user    ON payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_mp_id   ON payments (mp_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_expires ON payments (expires_at);

-- ─── Função: verificar se premium está ativo (não expirado) ──────────────
CREATE OR REPLACE FUNCTION is_premium_active(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  v_is_premium    BOOLEAN;
  v_expires_at    TIMESTAMPTZ;
BEGIN
  SELECT is_premium, premium_expires_at
  INTO v_is_premium, v_expires_at
  FROM users WHERE id = p_user_id;

  -- Se premium e não expirado
  IF v_is_premium AND (v_expires_at IS NULL OR v_expires_at > NOW()) THEN
    RETURN TRUE;
  END IF;

  -- Se expirou, atualiza automaticamente
  IF v_is_premium AND v_expires_at <= NOW() THEN
    UPDATE users SET is_premium = FALSE, updated_at = NOW()
    WHERE id = p_user_id;
  END IF;

  RETURN FALSE;
END;
$$;

-- ─── Verificação final ────────────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('is_premium','premium_plan','premium_expires_at','premium_activated_at')
ORDER BY column_name;
