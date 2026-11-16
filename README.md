# NutriAI

App mobile de dieta e treino gerados por IA. Você fotografa o prato, a IA calcula os nutrientes, e o app monta e ajusta o plano alimentar e de treino a partir do seu perfil.

## O que ele faz

- **Scan de refeição:** foto do prato analisada por visão computacional (Gemini 2.5 Flash), com estimativa de calorias e macronutrientes.
- **Plano de dieta e treino:** gerado por LLM (Llama 3.3 70B via Groq) a partir do objetivo, das restrições alimentares e da rotina do usuário, com troca de itens pelo próprio app.
- **Coach por chat:** conversa com a IA sobre a dieta e o treino.
- **Progresso e engajamento:** relatório semanal, ranking, modo cooperativo, XP e notificações.
- **Assinatura:** período de teste e plano premium com pagamento via Mercado Pago.
- **Privacidade:** consentimento LGPD, termos, política de privacidade e exclusão de conta pelo app.
- **Idiomas:** português e inglês.

## Stack

| Camada | Tecnologia |
|---|---|
| App | React Native, Expo (SDK 54), Expo Router, TypeScript |
| Back-end | Supabase: Postgres com Row Level Security, Auth e Edge Functions (Deno) |
| IA | Gemini 2.5 Flash (visão), Groq / Llama 3.3 70B (planos e coach) |
| Pagamentos | Mercado Pago |
| Observabilidade | Sentry (erros) e PostHog (analytics) |
| Build | EAS Build |

## Arquitetura

As chamadas de IA e de pagamento acontecem em **Edge Functions do Supabase**, nunca no app. Assim as chaves do Gemini, do Groq e do Mercado Pago ficam só no servidor; o app conhece apenas a URL do projeto e a chave pública (anon), protegida pelas políticas de RLS do banco.

```
app (Expo)  ──►  Supabase Edge Functions  ──►  Gemini / Groq / Mercado Pago
     │                    │
     └──── Supabase Auth + Postgres (RLS) ◄──┘
```

Edge Functions: `analyze-meal`, `generate-plan`, `swap-item`, `coach-message`, `exercise-gif`, `create-payment`, `cancel-subscription`, `set-premium`, `delete-user`.

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY
npm start
```

As migrações do banco ficam em `supabase/migrations/` e as funções em `supabase/functions/`. As chaves das IAs e do Mercado Pago são configuradas como secrets do Supabase.

## Autor

Jimmy Vidal · [github.com/JVidal021](https://github.com/JVidal021) · [jimmyvidal.pages.dev](https://jimmyvidal.pages.dev)
