-- ============================================================
-- NutriAI — Endurecimento de Segurança & Performance
-- Aplicado via Supabase MCP em 2026-05-28
-- ============================================================

-- 1) SEGURANÇA: remover policy redundante e perigosa em payments
--    (WITH CHECK true permitia qualquer um inserir pagamentos falsos;
--     o app nunca insere via client, só edge functions com service_role)
DROP POLICY IF EXISTS payments_insert ON public.payments;

-- 2) PERFORMANCE: recriar policies usando (select auth.uid())
--    evita reavaliação por linha (auth_rls_initplan)
DROP POLICY IF EXISTS checkins_own ON public.checkins;
CREATE POLICY checkins_own ON public.checkins FOR ALL
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS coach_logs_own ON public.coach_logs;
CREATE POLICY coach_logs_own ON public.coach_logs FOR ALL
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS consents_own ON public.consents;
CREATE POLICY consents_own ON public.consents FOR ALL
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS coop_own ON public.coop_links;
CREATE POLICY coop_own ON public.coop_links FOR ALL
  USING (((select auth.uid()) = user_id) OR ((select auth.uid()) = partner_id))
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS meals_own ON public.meals;
CREATE POLICY meals_own ON public.meals FOR ALL
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS payments_own ON public.payments;
CREATE POLICY payments_own ON public.payments FOR ALL
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS scan_logs_own ON public.scan_logs;
CREATE POLICY scan_logs_own ON public.scan_logs FOR ALL
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS weight_own ON public.weight_logs;
CREATE POLICY weight_own ON public.weight_logs FOR ALL
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS workouts_own ON public.workouts;
CREATE POLICY workouts_own ON public.workouts FOR ALL
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS xp_events_own ON public.xp_events;
CREATE POLICY xp_events_own ON public.xp_events FOR ALL
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- users: consolidar 4 policies sobrepostas em 1 (resolve multiple_permissive_policies)
DROP POLICY IF EXISTS users_own ON public.users;
DROP POLICY IF EXISTS users_insert_own ON public.users;
DROP POLICY IF EXISTS users_select_own ON public.users;
DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_own ON public.users FOR ALL
  USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);

-- 3) PERFORMANCE: indexar FKs de coop_links
CREATE INDEX IF NOT EXISTS idx_coop_links_user_id    ON public.coop_links(user_id);
CREATE INDEX IF NOT EXISTS idx_coop_links_partner_id ON public.coop_links(partner_id);

-- 4) SEGURANÇA: fixar search_path nas funções SECURITY DEFINER
--    (pg_temp por último = protege contra search_path hijacking)
ALTER FUNCTION public.add_xp(uuid, text, integer, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.delete_user_account(uuid)          SET search_path = public, pg_temp;
ALTER FUNCTION public.redeem_promo_code(text, uuid)      SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_old_coach_logs()           SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_old_scan_logs()            SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_inactive_users()            SET search_path = public, pg_temp;
ALTER FUNCTION public.upsert_user_from_auth()            SET search_path = public, pg_temp;

-- 5) SEGURANÇA: remover EXECUTE de anon/authenticated em funções internas (trigger/cron)
REVOKE EXECUTE ON FUNCTION public.handle_new_user()        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user()   FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_user_from_auth()  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_inactive_users()  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_xp(uuid, text, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_user_account(uuid)         FROM anon;
