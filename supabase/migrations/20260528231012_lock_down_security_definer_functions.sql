-- ============================================================
-- Travar funções SECURITY DEFINER: revogar de PUBLIC (que cobre anon/authenticated)
-- e conceder apenas a service_role. Triggers/cron rodam como owner (postgres),
-- então continuam funcionando.
-- Aplicado via Supabase MCP em 2026-05-28
-- ============================================================

DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.add_xp(uuid, text, integer, text)',
    'public.delete_user_account(uuid)',
    'public.handle_new_user()',
    'public.handle_new_auth_user()',
    'public.upsert_user_from_auth()',
    'public.notify_inactive_users()',
    'public.cleanup_old_coach_logs()',
    'public.cleanup_old_scan_logs()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;

-- redeem_promo_code: necessário no onboarding (anon antes da confirmação de e-mail).
REVOKE EXECUTE ON FUNCTION public.redeem_promo_code(text, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.redeem_promo_code(text, uuid) TO anon, authenticated, service_role;
