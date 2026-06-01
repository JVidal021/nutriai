-- ════════════════════════════════════════════════════════════════════════
-- Migration: segurança do redeem_promo_code + audit_log
-- Aplicada em produção em 2026-06-01
-- ════════════════════════════════════════════════════════════════════════

-- 1. redeem_promo_code: valida que o chamador só resgata para si mesmo.
--    Fecha a brecha de passar p_user_id de outro usuário.
--    O app sempre chama com sessão ativa (após confirmar e-mail), auth.uid() existe.
CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code text, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_promo      promo_codes%ROWTYPE;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Validação do chamador: só pode resgatar para si mesmo
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autorizado.');
  END IF;

  SELECT * INTO v_promo
  FROM promo_codes
  WHERE code = UPPER(TRIM(p_code))
    AND used_count < max_uses
    AND (valid_until IS NULL OR valid_until > NOW())
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código inválido ou já esgotado.');
  END IF;

  v_expires_at := NOW() + (v_promo.trial_days || ' days')::INTERVAL;

  UPDATE users SET
    is_premium           = true,
    premium_plan         = 'trial',
    subscription_type    = 'trial',
    premium_expires_at   = v_expires_at,
    premium_activated_at = NOW(),
    promo_code_used      = UPPER(TRIM(p_code)),
    updated_at           = NOW()
  WHERE id = p_user_id
    AND promo_code_used IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Você já utilizou um código de convite anteriormente.');
  END IF;

  UPDATE promo_codes SET used_count = used_count + 1
  WHERE id = v_promo.id;

  RETURN jsonb_build_object(
    'success',    true,
    'trial_days', v_promo.trial_days,
    'expires_at', v_expires_at
  );
END;
$function$;

-- Remove acesso do anon (só usuários autenticados resgatam)
REVOKE EXECUTE ON FUNCTION public.redeem_promo_code(text, uuid) FROM anon;

-- 2. audit_log: nega acesso público (anon/authenticated). Só service_role escreve.
DROP POLICY IF EXISTS audit_log_no_public_access ON public.audit_log;
CREATE POLICY audit_log_no_public_access
  ON public.audit_log
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
