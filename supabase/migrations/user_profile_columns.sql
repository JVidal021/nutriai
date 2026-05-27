-- ============================================================
-- Migração: colunas de perfil completo do usuário
-- Execute no Supabase SQL Editor antes de publicar o app
-- ============================================================

-- Colunas de perfil que faltavam no INSERT do onboarding
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gender          TEXT         DEFAULT 'neu',
  ADD COLUMN IF NOT EXISTS profile         TEXT         DEFAULT 'escultura',
  ADD COLUMN IF NOT EXISTS activity_level  TEXT         DEFAULT 'moderate',
  ADD COLUMN IF NOT EXISTS height          INTEGER      DEFAULT 170,
  ADD COLUMN IF NOT EXISTS weight          NUMERIC(5,1) DEFAULT 70,
  ADD COLUMN IF NOT EXISTS target_weight   NUMERIC(5,1) DEFAULT 70,
  ADD COLUMN IF NOT EXISTS age             INTEGER      DEFAULT 25,
  ADD COLUMN IF NOT EXISTS restrictions    JSONB        DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ DEFAULT NULL;

-- Índice para buscas por premium ativo
CREATE INDEX IF NOT EXISTS idx_users_premium
  ON users(is_premium, premium_expires_at)
  WHERE is_premium = TRUE;

COMMENT ON COLUMN users.gender         IS 'masc | fem | neu | skip';
COMMENT ON COLUMN users.profile        IS 'escultura | vitalidade | harmonia';
COMMENT ON COLUMN users.activity_level IS 'sedentary | light | moderate | active';
COMMENT ON COLUMN users.restrictions   IS 'Array JSON de restrições alimentares';

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
