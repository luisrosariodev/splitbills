// divvi — cyan #00CFFF → purple #7B2FFF gradient brand
// rosariodev · divvi

export const GRADIENT = ['#00CFFF', '#7B2FFF'] as const;

export const T = {
  // ── Surfaces ──────────────────────────────────────────────
  bg:          '#F8F7FF',   // barely-there purple tint
  surface:     '#FFFFFF',
  surfaceAlt:  '#F0EFFE',   // inputs — light purple tint
  surfaceHigh: '#F0EFFE',
  overlay:     '#FFFFFF',

  // ── Borders ───────────────────────────────────────────────
  border:       '#E6E0FF',
  borderMid:    '#C4B8F5',
  borderStrong: '#C4B8F5',

  // ── Text ─────────────────────────────────────────────────
  text:     '#160C2E',   // near-black, deep purple undertone
  textSec:  '#6A5D8C',
  textSub:  '#6A5D8C',   // compat alias
  textDim:  '#A898C8',
  textMuted:'#A898C8',   // compat alias

  // ── Accent: gradient midpoint purple-blue ─────────────────
  accent:       '#6535E8',
  accentDim:    'rgba(101, 53, 232, 0.09)',
  accentSubtle: 'rgba(101, 53, 232, 0.09)',  // compat
  accentText:   '#6535E8',

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

// Avatar palette — purple-anchored vivid
export const AVATAR_PALETTE = [
  '#6535E8', '#1DB87A', '#D97706',
  '#E53E3E', '#00B4D8', '#7B2FFF',
];
