-- ============================================================
-- Migração: tabela coach_logs para rate limiting do coach IA
-- Limita usuários gratuitos a 5 mensagens por dia
-- Execute no Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS coach_logs (
  id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para a query de contagem diária: WHERE user_id = ? AND sent_at >= hoje
CREATE INDEX IF NOT EXISTS idx_coach_logs_user_date
  ON coach_logs(user_id, sent_at DESC);

-- RLS: usuário só enxerga seus próprios registros
ALTER TABLE coach_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_logs_own" ON coach_logs;
CREATE POLICY "coach_logs_own" ON coach_logs
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Limpeza automática de logs com mais de 2 dias
CREATE OR REPLACE FUNCTION cleanup_old_coach_logs()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM coach_logs WHERE sent_at < NOW() - INTERVAL '2 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cleanup_coach_logs ON coach_logs;
CREATE TRIGGER trg_cleanup_coach_logs
  AFTER INSERT ON coach_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_old_coach_logs();

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
