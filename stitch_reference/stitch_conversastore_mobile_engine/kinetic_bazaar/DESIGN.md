---
name: Kinetic Bazaar
colors:
  surface: '#0f131d'
  surface-dim: '#0f131d'
  surface-bright: '#353944'
  surface-container-lowest: '#0a0e18'
  surface-container-low: '#171b26'
  surface-container: '#1c1f2a'
  surface-container-high: '#262a35'
  surface-container-highest: '#313540'
  on-surface: '#dfe2f1'
  on-surface-variant: '#e4beb6'
  inverse-surface: '#dfe2f1'
  inverse-on-surface: '#2c303b'
  outline: '#ab8982'
  outline-variant: '#5b403a'
  surface-tint: '#ffb4a4'
  primary: '#ffb4a4'
  on-primary: '#630e00'
  primary-container: '#ff5733'
  on-primary-container: '#580c00'
  inverse-primary: '#b72301'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#c0c1ff'
  on-tertiary: '#1000a9'
  tertiary-container: '#8084ff'
  on-tertiary-container: '#0d0097'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdad3'
  primary-fixed-dim: '#ffb4a4'
  on-primary-fixed: '#3d0600'
  on-primary-fixed-variant: '#8c1800'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#e1e0ff'
  tertiary-fixed-dim: '#c0c1ff'
  on-tertiary-fixed: '#07006c'
  on-tertiary-fixed-variant: '#2f2ebe'
  background: '#0f131d'
  on-background: '#dfe2f1'
  surface-variant: '#313540'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 44px
    fontWeight: '700'
    lineHeight: 52px
  headline-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 34px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '700'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
  currency-display:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style
The design system bridges the kinetic warmth of West African social commerce with the precision of contemporary fintech. Built for high-frequency, peer-to-merchant conversational transactions, it synthesizes high-contrast mobile ergonomics with tactile, interactive visual cues. The design movement pairs **Tactile High-Contrast** with structured **Glass-Tinted Surfaces**: massive typography, deliberate tap affordances calibrated for single-thumb navigation, and deep, pitch-dark backdrops that allow vibrant transactional accents to pop effortlessly.

The interface evokes immediacy, trust, and momentum. It minimizes the cognitive load of cross-border and cross-currency checkout (FCFA, EUR, USD) by embedding trust signals directly into social checkout funnels (WhatsApp, Instagram, TikTok, Messenger). Every view is sculpted to feel snappy, conversational, and thumb-friendly.

## Colors
The system operates on an unapologetic, high-contrast dark foundation designed to save OLED battery on mobile devices while maximizing legibility under harsh ambient sunlight.

- **Primary (`#FF5733` Terracotta Glow):** Energizing, high-conversion accent for urgent call-to-actions, cart badges, flash tags, and active states.
- **Secondary (`#10B981` Conversational Jade):** Directly aligned with WhatsApp and instant communication. Reserved for verified checkouts, confirmed orders, positive status badges, and live chat initiations.
- **Tertiary (`#6366F1` Hyper Indigo):** Supports secondary metrics, channel links, and digital ledger accents.
- **Neutral Canvas (`#0B0F19` Deep Void & `#111827` Abyssal Surface):** A rich, blue-tinted near-black that grounds the vibrant accents without the deadness of pure `#000000`.

### State & Contextual Accents
- **Confirmed Sale:** `#10B981` (Surface: `rgba(16, 185, 129, 0.12)`)
- **Pending 24h:** `#F59E0B` (Surface: `rgba(245, 158, 11, 0.12)`)
- **Intent / Prospect:** `#818CF8` (Surface: `rgba(99, 102, 241, 0.12)`)
- **Border / Divider Subtlety:** `#1E293B`
- **Text Hierarchy:** High-emphasis white (`#F8FAFC`), Mid-emphasis muted slate (`#94A3B8`), Low-emphasis placeholder (`#64748B`).

## Typography
The pairing establishes an expressive, progressive identity:

- **Space Grotesk (Headlines & Numerical Balances):** Delivers geometric confidence, street-level energy, and distinct numerals. It anchors product prices, currency indicators (FCFA / EUR / USD), and campaign anchors. Tabular numeral spacing is enforced on all monetary displays to prevent layout jitter during live totals updates.
- **Plus Jakarta Sans (Body & Operational Labels):** A rounded, approachable grotesque that maintains crisp legibility at small sizes across low-end and high-end smartphone displays alike. Used for metadata, buyer interactions, chat previews, and input controls.

## Layout & Spacing
The layout adheres to a **Mobile-First Dynamic Column System**:
- **Mobile (< 768px):** 4 fluid columns with `1rem` margins and `1rem` gutters. All primary interactive elements, including checkouts and social action drawers, live strictly within the bottom 45% screen zone (the **Thumb Arc**).
- **Tablet (768px - 1024px):** 8 fluid columns with `1.5rem` margins and `1rem` gutters.
- **Desktop (> 1024px):** 12 centered columns maxing out at `1280px` canvas width, framing the conversational feeds in an app-like split-pane experience (catalog on the left, social thread/checkout on the right).

Spacing utilizes an 8-point base rhythm, condensed down to 4px increments for tight micro-elements like currency tags and notification pills.

## Elevation & Depth
Depth is created through a synergy of **Tonal Layering** and **Vibrant Ambient Glows**:

- **Level 0 (Canvas):** Deep Void (`#0B0F19`), no shadow.
- **Level 1 (Feed & List Items):** Dark Charcoal (`#111827`) elevated with a subtle outline (`1px solid rgba(255, 255, 255, 0.06)`).
- **Level 2 (Cards, Product Tiles & Drawers):** Midnight Slate (`#1E293B`) layered above cards with an ambient drop: `0px 12px 32px -4px rgba(0, 0, 0, 0.45)`.
- **Level 3 (Floating Conversational Bars & Sticky Bottom Triggers):** Tinted glassmorphism utilizing `backdrop-filter: blur(16px)`, background `rgba(17, 24, 39, 0.85)`, and a top micro-stroke (`rgba(255, 255, 255, 0.1)`).
- **Interactive Focus / Kinetic Aura:** Active primary elements emit a colored photon blur (`0px 8px 24px -2px rgba(255, 87, 51, 0.35)` for CTA, `0px 8px 24px -2px rgba(16, 185, 129, 0.30)` for WhatsApp handoff).

## Shapes
The shape language uses `roundedness: 2` (rounded profile with `0.5rem` / `8px` base, scaling to `1rem` / `16px` for cards and `1.5rem` / `24px` for bottom sheets).

- **Standard Buttons & Form Controls:** `0.75rem` (12px) to provide a soft, tactile touch target.
- **Cards, Modals & Drawers:** `1rem` (16px) or `1.5rem` (24px) for upper corners of bottom sheets.
- **Badges, Channel Selectors & Floating Pills:** Fully curved pill morphology (`9999px`) to visually separate contextual markers from content cards.

## Components

### Buttons & Sticky Thumb Actions
- **Primary CTA ("Acheter en 1-Clic / Commander"):** Minimum height of `56px` for effortless thumb reach. Colored in Primary Terracotta (`#FF5733`) with bold contrasting white text, styled with an active compression micro-interaction (`transform: scale(0.98)`).
- **Conversational Channel Button ("WhatsApp Direct"):** Secondary Jade (`#10B981`) surface or dark surface with emerald border. Features channel icon on the leading edge and a responsive badge on the trailing edge.
- **Micro-haptics / Press States:** All interactive touchpoints transition smoothly over `150ms cubic-bezier(0.4, 0, 0.2, 1)`.

### Status Badges
- **Vente Confirmée:** Jade background (`rgba(16, 185, 129, 0.15)`), solid Jade border (`#10B981`), white/green text, accompanied by a checkmark indicator.
- **En Attente 24h:** Amber background (`rgba(245, 158, 11, 0.15)`), Amber border (`#F59E0B`), displaying a countdown micro-clock.
- **Intention / Panier Ouvert:** Indigo tint (`rgba(99, 102, 241, 0.15)`), Indigo border (`#6366F1`).
- All badges use `label-sm`, all-caps tracking (`letter-spacing: 0.05em`), pill-shaped geometry (`roundedness: 9999px`), and inner padding of `4px 10px`.

### Product & Promo Cards
- **Product Tile:** Aspect ratio 1:1 or 4:5 image container with a bottom overlay containing product name, FCFA display in Space Grotesk, and a quick-tap social share trigger.
- **Promo Banners:** Flush full-width or card-inset containers with dynamic diagonal gradient stripes or high-contrast duotone badges ("PROMO", "FLASH 48H").

### Channel Selector Segmented Controls
- Horizontal thumb carousel displaying native brand marks (WhatsApp, Instagram DM, Messenger, TikTok Shop).
- Selected state activates a high-contrast glow matching the platform or Terracotta primary.

### Form Fields & Conversational Inputs
- Height of `52px`, dark background (`#111827`), inactive border in `#1E293B`, focus ring in `#FF5733`.
- Currency prefix/suffix (e.g., `XOF / FCFA`) pinned as a bold static tag inside the input field.

### Bottom Sheets & Conversational Drawers
- Mobile slide-ups replacing desktop modals.
- Includes a top visual grab bar (`width: 36px`, `height: 4px`, `background: #334155`, `radius: 2px`) and quick-close gestures.