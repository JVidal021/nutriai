# NutriAI — Handoff de contexto (onde paramos)

> Cole este arquivo no projeto e, ao abrir o Claude na máquina de casa, diga:
> "Leia o HANDOFF.md para retomar o contexto." Assim retomamos na hora.

_Última atualização: build v1.0.1 disparado._

---

## Estado atual do projeto

### 1. i18n — 100% concluído e verificado
- Stack: `i18next` + `react-i18next` + `expo-localization`. Hook `useT()` em `@/i18n/useT`.
- `src/i18n/pt.json` e `src/i18n/en.json` — **901 chaves, 100% sincronizadas**, zero faltando.
- Todas as telas e componentes usam `t()`. Verificado: 0 chaves `t()` ausentes nos JSONs.
- **Exceção intencional:** texto jurídico estático (PrivacyScreen/TermsScreen/LGPDScreen) fica em PT — só a navegação/botões foram traduzidos. (Traduzir texto legal exige revisão jurídica.)
- **RESTRICTIONS** (ProfileScreen/Onboarding) fica em PT de propósito — são valores de DB enviados à IA.

### 2. Bugs corrigidos nesta rodada
- **ProfileScreen**: usava `progress.xpHistory` (sempre `undefined`) → corrigido para `xpHistory` da raiz do store. O cálculo de dias ativos da semana estava sempre vazio.
- **notifications.ts**: handler atualizado p/ SDK 54 (`shouldShowBanner` + `shouldShowList` no lugar de `shouldShowAlert`).
- **ai.ts**: removido cast `as string` no `encoding` do `readAsStringAsync`.
- **Skeleton.tsx**: `width: number | string` → `DimensionValue`.
- **CoachScreen / ai.ts**: `sendCoachMessage` agora usa o tipo compartilhado `PlanContext`.
- **OnboardingScreen**: tipo local de `trialData` agora inclui `subscriptionType`.
- **tsconfig.json**: `ignoreDeprecations: "6.0"` → `"5.0"` (o "6.0" quebrava o `tsc`).
- 4 imports `@types/index` → `@/types/index` (resolvia erro TS6137).
- Datas/números: removido `'pt-BR'`/`ptBR` fixos (usa locale do sistema).

**Type-check:** `npx tsc --noEmit` → **0 erros em `src/`**.

### 3. Versões (subidas para o build)
- `app.json`: `version 1.0.1` · `android.versionCode 2` · `ios.buildNumber 2`
- `eas.json`: adicionado `cli.appVersionSource: "local"`

### 4. Build
- **Preview APK Android** disparado no EAS (mesmo keystore → instala por cima, sem desinstalar).
- Link: https://expo.dev/accounts/jimmyvidal/projects/nutriai/builds/48b448a8-71f6-4ff4-858a-e57f467272bd

---

## Supabase (projeto `nrlspfndloqzodujnajp` — NutriAI, sa-east-1)

13 tabelas (todas com RLS), 9 edge functions ativas. App só chama o RPC `redeem_promo_code`;
nunca insere em `payments` nem chama `delete_user_account`/`add_xp` direto (isso roda server-side com service_role).

### Achados de segurança/performance (dos advisors)
- `payments_insert` com `WITH CHECK (true)` — redundante e permite anon inserir pagamento falso. **Candidato a DROP.**
- 3 policies de `users` (`users_select_own`/`insert_own`/`update_own`) duplicam `users_own` → "multiple permissive policies". **Consolidar.**
- 16 policies usam `auth.uid()` direto → trocar por `(select auth.uid())` (`auth_rls_initplan`).
- 8 funções SECURITY DEFINER sem `search_path` fixo → setar `search_path`.
- `redeem_promo_code` NÃO valida `auth.uid()` (aceita `p_user_id`) e é executável por anon — decisão de produto (fluxo de onboarding antes de confirmar e-mail). `add_xp`/`delete_user_account` JÁ validam internamente.
- FKs sem índice em `coop_links` (user_id, partner_id).

> OBS: confirmar com o Jimmy se as migrations de correção chegaram a ser aplicadas no banco.
> Se sim, estão em `supabase/migrations/`. Se não, revisar/aplicar com `apply_migration`.

### ⏳ Pendência manual (painel Supabase)
- Ativar **"Leaked password protection"** em Authentication → Policies (não dá via SQL).

---

## Como retomar em casa
1. Descompacta o zip / `git pull`
2. `npm install`
3. `npx expo start` (ou baixa o APK do link do build acima)
4. Abre o Claude e diz: "Leia o HANDOFF.md"

## Próximos passos sugeridos
- [ ] Confirmar status do build APK e testar a versão nova no celular
- [ ] Decidir/aplicar as correções de segurança do Supabase (se ainda não aplicadas)
- [ ] Ativar leaked password protection no painel
- [ ] (Opcional) Traduzir os textos jurídicos com revisão adequada
