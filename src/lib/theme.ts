// divvi by rosariodev
// Product accent: #0B5884 (rosariodev blue) → gradient endpoint #00CFFF
// Font: Sansation (rosariodev brand) — loaded via expo-font

export const GRADIENT = ['#00CFFF', '#0B5884'] as const;

// Typography — use these fontFamily strings after fonts are loaded
export const FONTS = {
  regular: 'Sansation-Regular',
  bold:    'Sansation-Bold',
} as const;

export const T = {
  // ── Surfaces ──────────────────────────────────────────────
  bg:          '#F5F6F7',   // rosariodev light
  surface:     '#FFFFFF',
  surfaceAlt:  '#EDF3F7',   // blue-tinted input bg
  surfaceHigh: '#EDF3F7',
  overlay:     '#FFFFFF',

  // ── Borders ───────────────────────────────────────────────
  border:       '#D6E4EF',
  borderMid:    '#A8C4D8',
  borderStrong: '#7AAFC9',

  // ── Text ─────────────────────────────────────────────────
  text:     '#111827',   // rosariodev dark
  textSec:  '#687280',   // rosariodev gray
  textSub:  '#687280',
  textDim:  '#9BAAB6',
  textMuted:'#9BAAB6',

  // ── Accent: rosariodev blue ───────────────────────────────
  accent:       '#0B5884',
  accentDim:    'rgba(11, 88, 132, 0.09)',
  accentSubtle: 'rgba(11, 88, 132, 0.09)',
  accentText:   '#0B5884',

  // ── Semantic ─────────────────────────────────────────────
  success:   '#1DB87A',
  successBg: 'rgba(29, 184, 122, 0.09)',
  warning:   '#D97706',
  warningBg: 'rgba(217, 119, 6, 0.09)',
  danger:    '#E53E3E',
  dangerBg:  'rgba(229, 62, 62, 0.09)',

  // ── Brand ────────────────────────────────────────────────
  whatsapp: '#25D366',
};

// Avatar palette — blue-anchored
export const AVATAR_PALETTE = [
  '#0B5884', '#1DB87A', '#D97706',
  '#E53E3E', '#00B4D8', '#2E7DAB',
];
