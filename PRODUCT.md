# divvi — Product Context

## What is divvi

divvi is a mobile app (iOS-first) for splitting restaurant bills and shared expenses with friends. The core loop: add people, assign items to each person, calculate automatically with tip and tax, share via WhatsApp or PDF. Built by Luis Rosario Alicea under the rosariodev brand.

**Not** a general expense tracker. Focused on the restaurant/outing scenario: real-time at the table, fast input, immediate share.

## Stack

- **Runtime**: React Native 0.81.5 / Expo SDK 54
- **Navigation**: @react-navigation/native-stack + @react-navigation/bottom-tabs (custom tab bar)
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Icons**: @expo/vector-icons (Ionicons)
- **Key libs**: expo-haptics, expo-linear-gradient, expo-local-authentication, expo-notifications, expo-print, expo-sharing, expo-image-picker, react-native-gesture-handler

## Brand / Design

- **Accent**: `#6535E8` (purple)
- **Gradient**: `['#00CFFF', '#7B2FFF']` (cyan → purple)
- **Background**: `#F8F7FF` (barely-purple white)
- **Surface**: `#FFFFFF`
- **Border**: `#E6E0FF`
- **Text**: `#160C2E` (near-black, purple undertone)
- **textSec**: `#6A5D8C` | **textDim**: `#A898C8`
- Theme: light, restrained color strategy, no emojis as icons
- Typography: system font, bold hierarchy (800 for heroes, 700 for titles, 600 for labels)

## Supabase Schema

```
splits         (id, name, user_id, tip_amount, tax_amount, created_at)
people         (id, split_id, name)
items          (id, split_id, name, price)
item_assignments (item_id, person_id)
groups         (id, name, user_id, created_at)
group_splits   (group_id, split_id)
settlements    (id, split_id, payer_name, payee_name, amount, settled, settled_at, created_at)
saved_contacts (id, user_id, name)
profiles       (user_id, display_name)
```

## Navigation Structure

```
NavigationContainer
  Stack (outer)
    MainTabs (bottom tabs)
      Home       — hero CTA, "Nuevo divvi" + "Ver historial"
      Historial  — list of splits + groups, search, selection mode
      Stats      — spending stats, top people, month comparison
      Perfil     — user profile, settings access
    CreateSplit  — full form: people, items, tip/tax, OCR scan, share
    SplitDetail  — item breakdown, WhatsApp/PDF share, edit, "Ver pagos"
    GroupDetail  — multi-split group summary
    EditSplit    — same form as Create, pre-filled
    Settlements  — "Pagos": who paid, computed debts, register/confirm
    Settings     — currency, tip defaults, Face ID toggle
```

## Feature Status

### Done
- Email/password auth (Supabase)
- Create split: people, items, tip %, tax %, custom amounts
- Edit split
- History with date grouping (Hoy / Esta semana / Antes), search, long-press rename
- Groups: select multiple splits, create group, WhatsApp group summary
- Split detail: per-person breakdown, WhatsApp share, PDF export
- Onboarding: 3 animated slides, AsyncStorage flag
- Tab bar: custom floating pill design (Ionicons, active pill = accent)
- Settlements / Pagos: select who paid, compute debts from item assignments, register payments, confirm settlements
- Stats: total spent, this month vs last month bar chart, top people
- Face ID / Touch ID: toggle in Settings, gate on app open, re-lock after 30s background
- OCR receipt scanning: Google Vision API, base64 image, auto-parses items + prices
- Offline queue: saves splits locally when no connection, syncs on reconnect
- Recent people suggestions: loads from past splits ordered by frequency, filters while typing
- Notifications: infrastructure exists (expo-notifications), not yet triggered at startup

### Pending / Known Issues
- OCR parser debugging in progress (Vision API returns text but parser may miss items)
- `requestNotificationPermission()` never called at app startup
- Swipe actions on history items (currently long-press → Alert)
- Receipt photo not shown in split detail
- Saved contacts directory (UI exists partially via recent suggestions, no dedicated screen)

## Environment Variables

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_GOOGLE_VISION_KEY=...   # Cloud Vision API, restricted to Vision API only
```

## Key Files

```
App.tsx                          — root: auth, onboarding, biometric gate, tab/stack nav
src/lib/theme.ts                 — all design tokens (T, GRADIENT, AVATAR_PALETTE)
src/lib/splitService.ts          — all Supabase queries + business logic
src/lib/settings.ts              — AsyncStorage: currency, tip, biometric
src/lib/offlineQueue.ts          — offline split queue
src/lib/notifications.ts        — push notification helpers
src/types/navigation.ts          — RootStackParamList + TabParamList
src/screens/CreateSplitScreen.tsx — main creation flow + OCR
src/screens/SettlementsScreen.tsx — Pagos: who paid, debts, register
src/screens/StatsScreen.tsx      — spending analytics
src/screens/OnboardingScreen.tsx — 3-slide onboarding
```

## Developer Notes

- Always read https://docs.expo.dev/versions/v56.0.0/ before touching Expo APIs
- `T` from `theme.ts` is the single source of truth for all colors — never hardcode colors
- No emojis as UI icons anywhere — use Ionicons or styled Views
- All navigation types in `src/types/navigation.ts` — update when adding screens
- Face ID requires `NSFaceIDUsageDescription` in `app.json` infoPlist + expo-local-authentication plugin
- Tab bar is fully custom (`CustomTabBar` in App.tsx) — not using screenOptions tabBarIcon
- OCR: `parseReceiptText()` in CreateSplitScreen — takes raw Vision API text, extracts item/price pairs
