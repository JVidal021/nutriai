import { ScrollViewStyleReset } from 'expo-router/html'
import type { PropsWithChildren } from 'react'

/**
 * HTML document customizado para suporte a PWA (iOS "Adicionar à Tela Inicial")
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* ── PWA / iOS ── */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="NutriAI" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0A0A0A" />
        <meta name="application-name" content="NutriAI" />

        {/* ── SEO / Social ── */}
        <title>NutriAI — Dieta e treino por IA</title>
        <meta name="description" content="Plano alimentar e de treino personalizado com Inteligência Artificial." />

        {/* ── Ícones ── */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />

        {/* ── Estilo base ── */}
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `
          html, body, #root {
            height: 100%;
            background-color: #0A0A0A;
          }
          body { overflow: hidden; }
          #root { display: flex; flex: 1; }
          /* Remove tap highlight no iOS */
          * { -webkit-tap-highlight-color: transparent; }
        `}} />
      </head>
      <body>{children}</body>
    </html>
  )
}
