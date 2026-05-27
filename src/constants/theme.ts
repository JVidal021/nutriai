/**
 * theme.ts — Gradientes e constantes visuais do NutriAI
 */

// ─── GRADIENTES DE RANK ───────────────────────────────────────────────────
export const RANK_GRADIENTS: Record<string, [string, string, ...string[]]> = {
  bronze:    ['#CD7F32', '#7B3F00'],
  silver:    ['#C0C0C0', '#6B7280'],
  gold:      ['#FFD700', '#B8860B'],
  diamond:   ['#67E8F9', '#2DD4BF'],
  legendary: ['#C084FC', '#F43F5E'],
}

// Cor de texto sobre o gradiente de rank
export const RANK_TEXT_COLOR: Record<string, string> = {
  bronze:    '#FFF8F0',
  silver:    '#F8FAFC',
  gold:      '#1A0500',
  diamond:   '#0F172A',
  legendary: '#FFF0FF',
}

// ─── GRADIENTES DE CARD ───────────────────────────────────────────────────
export const CARD_GRADIENTS = {
  calories:     ['#0D2010', '#0A0A0A'] as [string, string],
  workout:      ['#0D0A20', '#0A0A0A'] as [string, string],
  coach:        ['#0A1A15', '#0A0A0A'] as [string, string],
  premium:      ['#141A00', '#0A0A0A'] as [string, string],
  danger:       ['#1A0808', '#0A0A0A'] as [string, string],
}

// ─── SOMBRAS ─────────────────────────────────────────────────────────────
export const SHADOWS = {
  sm: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius:  4,
    elevation:     3,
  },
  md: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius:  8,
    elevation:     6,
  },
  accent: {
    shadowColor:   '#C8F060',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.20,
    shadowRadius:  12,
    elevation:     8,
  },
  rank: {
    shadowColor:   '#FFD700',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius:  12,
    elevation:     10,
  },
}

// ─── MOODS COM CORES ──────────────────────────────────────────────────────
export const MOOD_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  great:    { bg: '#0D2010', border: '#2DD4AA', text: '#2DD4AA' },
  good:     { bg: '#111800', border: '#C8F060', text: '#C8F060' },
  neutral:  { bg: '#1A1A1A', border: '#555550', text: '#888888' },
  tired:    { bg: '#1A1200', border: '#FF7A45', text: '#FF7A45' },
  exhausted:{ bg: '#1A0808', border: '#FF4F4F', text: '#FF4F4F' },
}
