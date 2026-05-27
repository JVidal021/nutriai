-- ============================================================
-- Migração de segurança NutriAI
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. Tabela de consentimentos LGPD
-- ============================================================
CREATE TABLE IF NOT EXISTS consents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consents    JSONB NOT NULL DEFAULT '{}',
  version     TEXT NOT NULL DEFAULT '1.0',
  ip_hash     TEXT,
  given_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consents_own" ON consents
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Coluna de consentimento aceito na tabela users
-- ============================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS consent_accepted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_version  TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS consent_given_at TIMESTAMPTZ DEFAULT NULL;

-- 3. Tabela de rate limiting de login (complementa o Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS login_attempts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash  TEXT NOT NULL,  -- hash do e-mail, nunca o e-mail em si
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success     BOOLEAN NOT NULL DEFAULT FALSE
);

-- Índice para consultas rápidas por e-mail + janela de tempo
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time
  ON login_attempts(email_hash, attempted_at DESC);

-- Limpeza automática de tentativas antigas (> 24h)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '24 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_cleanup_login_attempts
  AFTER INSERT ON login_attempts
  EXECUTE FUNCTION cleanup_old_login_attempts();

-- 4. Função de exclusão completa de conta (LGPD Art. 18)
-- ============================================================
-- Deleta TODOS os dados do usuário de forma cascata e segura
CREATE OR REPLACE FUNCTION delete_user_account(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- roda com permissão de superuser para deletar em cascata
SET search_path = public
AS $$
DECLARE
  v_count_meals     INTEGER;
  v_count_workouts  INTEGER;
  v_count_meals_del INTEGER;
BEGIN
  -- Verificar que o usuário só pode deletar a própria conta
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  -- Contar registros antes de deletar (para o log)
  SELECT COUNT(*) INTO v_count_meals    FROM meals    WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_count_workouts FROM workouts WHERE user_id = p_user_id;

  -- Deletar em ordem (respeita FKs — cascata cuida do resto)
  DELETE FROM consents     WHERE user_id = p_user_id;
  DELETE FROM checkins     WHERE user_id = p_user_id;
  DELETE FROM weight_logs  WHERE user_id = p_user_id;
  DELETE FROM meals        WHERE user_id = p_user_id;
  DELETE FROM workouts     WHERE user_id = p_user_id;
  DELETE FROM coop_links   WHERE user_id = p_user_id OR partner_id = p_user_id;

  -- Deletar o usuário em si (remove do auth.users também via trigger)
  DELETE FROM users WHERE id = p_user_id;

  -- Log de auditoria (sem dados pessoais)
  INSERT INTO audit_log (event, metadata, created_at)
  VALUES (
    'account_deleted',
    jsonb_build_object(
      'meals_deleted', v_count_meals,
      'workouts_deleted', v_count_workouts,
      'deleted_at', NOW()
    ),
    NOW()
  );

  RETURN jsonb_build_object('success', true, 'message', 'Conta e todos os dados excluídos com sucesso');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 5. Tabela de auditoria (logs sem dados pessoais)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event      TEXT NOT NULL,
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sem RLS — somente service_role pode ler (segurança por papel)
REVOKE ALL ON audit_log FROM anon, authenticated;

-- 6. Política de retenção automática (inatividade > 12 meses)
-- ============================================================
-- Marcador de notificação — usuário é avisado antes da exclusão
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_active_at  TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deletion_warning_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Função chamada por cron job (pg_cron) — executar 1x por semana
-- Requer extensão: CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('retention-check', '0 9 * * 1', 'SELECT notify_inactive_users()');
CREATE OR REPLACE FUNCTION notify_inactive_users()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER AS $$
BEGIN
  -- Marcar usuários inativos há > 11 meses para notificação (30 dias de aviso)
  UPDATE users
  SET deletion_warning_sent_at = NOW()
  WHERE last_active_at < NOW() - INTERVAL '11 months'
    AND deletion_warning_sent_at IS NULL
    AND consent_accepted = TRUE;
END;
$$;

-- 7. Criptografia em colunas sensíveis (requer pgcrypto)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Exemplo: criptografar coluna de peso (dados de saúde)
-- Em produção, use a chave de criptografia via variável de ambiente
-- ALTER TABLE users ALTER COLUMN weight TYPE TEXT USING pgp_sym_encrypt(weight::TEXT, current_setting('app.encryption_key'));

-- Por ora, adicionar comentário de documentação
COMMENT ON COLUMN users.weight IS 'Dado sensível (LGPD). Candidato para criptografia em v1.1';
COMMENT ON COLUMN users.height IS 'Dado sensível (LGPD)';
COMMENT ON TABLE  consents IS 'Registro de consentimentos LGPD. Nunca excluir manualmente.';

-- 8. Ativar rate limiting no Supabase Auth (via SQL)
-- ============================================================
-- Nota: Configure também via Dashboard > Authentication > Rate Limits
-- As configurações abaixo são referência dos valores recomendados

-- Max 5 tentativas de login por hora por e-mail
-- Max 3 tentativas de signup por hora por IP
-- Ambos configuráveis em: Dashboard > Auth > Rate Limits

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
