-- Impede que o app (roles anon/authenticated) conceda premium a si mesmo.
-- Rebaixar continua permitido; service_role e funções do dono (redeem_promo_code) passam.
create or replace function public.protege_campos_premium()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  atual public.users%rowtype;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    select * into atual from public.users where id = new.id;
    if found then
      -- upsert de linha existente: mantém o que já está no banco
      new.is_premium           := atual.is_premium;
      new.premium_plan         := atual.premium_plan;
      new.subscription_type    := atual.subscription_type;
      new.premium_expires_at   := atual.premium_expires_at;
      new.premium_activated_at := atual.premium_activated_at;
      new.mp_subscription_id   := atual.mp_subscription_id;
      new.promo_code_used      := atual.promo_code_used;
    else
      new.is_premium           := false;
      new.premium_plan         := null;
      new.subscription_type    := null;
      new.premium_expires_at   := null;
      new.premium_activated_at := null;
      new.mp_subscription_id   := null;
      new.promo_code_used      := null;
    end if;
    return new;
  end if;

  -- UPDATE: só deixa passar rebaixamento (desligar ou limpar)
  if new.is_premium and not coalesce(old.is_premium, false) then
    new.is_premium := old.is_premium;
  end if;
  if new.premium_expires_at is distinct from old.premium_expires_at and new.premium_expires_at is not null then
    new.premium_expires_at := old.premium_expires_at;
  end if;
  if new.premium_plan is distinct from old.premium_plan and new.premium_plan is not null then
    new.premium_plan := old.premium_plan;
  end if;
  if new.subscription_type is distinct from old.subscription_type and new.subscription_type is not null then
    new.subscription_type := old.subscription_type;
  end if;
  if new.premium_activated_at is distinct from old.premium_activated_at and new.premium_activated_at is not null then
    new.premium_activated_at := old.premium_activated_at;
  end if;
  if new.mp_subscription_id is distinct from old.mp_subscription_id and new.mp_subscription_id is not null then
    new.mp_subscription_id := old.mp_subscription_id;
  end if;
  if new.promo_code_used is distinct from old.promo_code_used then
    new.promo_code_used := old.promo_code_used;
  end if;
  return new;
end;
$$;

drop trigger if exists protege_campos_premium on public.users;
create trigger protege_campos_premium
  before insert or update on public.users
  for each row execute function public.protege_campos_premium();
