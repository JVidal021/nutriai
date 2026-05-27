-- ============================================================
-- Migração: tabela scan_logs para rate limiting persistente
-- Substitui o Map em memória que resetava a cada cold start
-- Execute no Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS scan_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scanned_at TIMESTAMPTZ NOT NULL    DEFAULT NOW()
);

-- Índice para a query de contagem diária: WHERE user_id = ? AND scanned_at >= hoje
CREATE INDEX IF NOT EXISTS idx_scan_logs_user_date
  ON scan_logs(user_id, scanned_at DESC);

-- RLS: usuário só enxerga seus próprios registros
ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scan_logs_own" ON scan_logs;
CREATE POLICY "scan_logs_own" ON scan_logs
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Limpeza automática de logs com mais de 2 dias (reduz tamanho da tabela)
CREATE OR REPLACE FUNCTION cleanup_old_scan_logs()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM scan_logs WHERE scanned_at < NOW() - INTERVAL '2 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cleanup_scan_logs ON scan_logs;
CREATE TRIGGER trg_cleanup_scan_logs
  AFTER INSERT ON scan_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_old_scan_logs();

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
