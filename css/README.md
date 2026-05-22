# PSOTS CSS Architecture v2.1
## Mobile-First, Production-Ready Design System

### Overview
This directory contains all CSS files organized by concern and function. All files follow a mobile-first approach with responsive breakpoints, use design tokens for consistency, and include smooth animations and transitions.

---

## Core Stylesheets

### `tokens.css` (5 KB)
**Single source of truth for design values**
- Color palette: Jade, Gold, Cream, neutrals, status colors
- Typography: Font families (Playfair Display, Nunito Sans)
- Spacing scale: sp-1 through sp-12 (4px - 48px)
- Border radius: sm to full
- Shadows: xs to lg with warm tint
- Transitions: snap, fast, base, slow, spring
- Z-index layers: bar, nav, modal, toast
- **NEW:** Easing curves for smooth motion

### `base.css` (4 KB)
**Foundation: resets, typography, and utilities**
- Global reset: `*` with proper box-sizing
- Responsive font sizing (mobile-first)
- Typography hierarchy: h1-h5, p, small
- Link styles with transitions
- Scrollbar customization
- Focus visible for accessibility
- **NEW:** Comprehensive utility classes (.text-muted, .text-center, etc.)
- **NEW:** Semantic HTML element styles

### `components.css` (12 KB)
**Reusable UI components**
- Motion utilities: fadeUp, fadeIn, slideIn, scaleIn, pulse, bounce
- **Buttons:** jade, outline, danger, google, telegram, ghost variants
  * Mobile-first sizing (48px min-height)
  * Hover states with elevation
  * Disabled and loading states
- **Form fields:** inputs, selects, textareas
  * Mobile-first (44px min-height)
  * Better focus states (jade glow + inset)
  * Error styling with animation
  * Field grids (1-col mobile, 2-col desktop)
- **Cards:** with animations and hover effects
- **Alerts:** success, error, warn, info with slide-in animation
- **Badges:** pending, approved, rejected
- **Type cards:** selectable with active state
- **Modal:** overlay with blur and animation
- **Toast:** notifications with variants
- **Loader, empty state, step indicators**

### `layout.css` (7 KB)
**Page-level layout and navigation**
- Disclaimer bar with slide animation
- Sticky navigation with scroll detection
- Page wrappers (.page-top, .card-page)
- Admin layout (topbar, tabs, signout)
- **NEW:** Mobile-first padding and spacing
- **NEW:** Better backdrop filters

---

## Page-Specific Stylesheets

### `dashboard.css` (5 KB)
**For: `/society/index.html`**
- Container and responsive padding
- Hero bar with gradient and texture
- Feature grid (1 mobile → 4 desktop)
- Tile cards with stagger animation
- Section headers with gold underline
- Group section titles
- Tile states: active, preview
- Badge styles (live, status)
- Loading shimmer animation

### `features.css` (8 KB)
**For: Marketplace, Carpooling, Lost & Found, Recommendations**
- Listing grid layout (mobile-first)
- Listing cards with full details
- Post new section forms
- Filter bar with search
- Carousel for horizontal scrolling
- Category chips with active state
- Empty state placeholder
- Form groups and actions

### `profile.css` (7 KB)
**For: `/society/profile.html`**
- Profile wrapper and header card
- Avatar with gradient background
- Profile sections with icons
- Field labels and values
- Profile actions (edit, delete, etc.)
- Verification badges
- Edit mode forms
- Family member management
- Action buttons (primary, secondary)

### `admin.css` (9 KB)
**For: `/society/admin.html`**
- Admin layout structure
- Data tables with hover states
- Table action buttons
- Admin cards and forms
- Form fields and validation
- Stats cards grid
- Moderation violation items
- Group settings with toggles
- Responsive table design

### `auth.css` (8 KB)
**For: `/society/login.html`, `/society/register.html`**
- Auth container layout
- Auth navigation and branding
- Auth card with animations
- Form inputs with states
- OTP input fields
- OAuth button variants
- Loading spinner states
- Divider with gradient
- Footer links

### `content.css` (9 KB)
**For: FAQ, About, Privacy, Terms, Guide**
- Content wrapper centering
- Typography for content pages
- Section styling with borders
- List styles with check marks
- FAQ accordion with animation
- Blockquotes with accent
- Code block styling
- Highlight boxes
- Tables with borders
- Call-to-action sections
- Breadcrumb navigation

### `pages.css` (6 KB)
**General page patterns (used across all pages)**
- Page wrapper and header
- Back link styling
- Footer with links
- Content grids (1, 2, 3 column)
- Section dividers
- Form groups
- Listing items
- Hero sections
- Info blocks
- Feature lists
- Profile cards
- Empty states

---

## Design System Features

### Color Palette
- **Primary:** Jade (#1a4a3a) — authority, trust
- **Accent:** Gold (#b8882a) — warmth, heritage
- **Background:** Cream (#f8f2e8) — welcoming, parchment
- **Status:** Green, Red, Amber, Blue, Telegram
- **Semantic:** Jade pale, Gold pale, Border with opacity

### Typography
- **Serif:** Playfair Display (headings, brand)
- **Sans:** Nunito Sans (body, UI)
- **Mobile:** h1 26px, h2 22px, h3 18px
- **Desktop:** h1 28px, h2 24px, h3 20px
- **Font weights:** 400 (regular), 500 (headings), 600 (buttons), 700 (bold)

### Spacing Scale
```
sp-1: 4px    sp-4: 16px   sp-8: 32px
sp-2: 8px    sp-5: 20px   sp-10: 40px
sp-3: 12px   sp-6: 24px   sp-12: 48px
```

### Shadows (warm-tinted)
- `--shadow-xs`: subtle (1px)
- `--shadow-sm`: small (2px)
- `--shadow-card`: default for cards
- `--shadow-lift`: on hover
- `--shadow-lg`: modals, toasts
- `--shadow-jade`: jade-tinted

### Animations
- **Easing:** cubic-bezier(0.22, 1, 0.36, 1) — smooth spring
- **Durations:** 0.12s snap, 0.18s fast, 0.24s base, 0.36s slow
- **Keyframes:** fadeUp, fadeIn, slideInLeft/Right, scaleIn, pulse, bounce, shimmer

### Responsive Breakpoints
```
Mobile (default): 320px+
Small tablet: 480px+
Tablet: 640px+
Desktop: 768px+
Large: 1024px+
```

---

## How to Use

### 1. Import All Files in HTML Head
```html
<link rel="stylesheet" href="/css/tokens.css">
<link rel="stylesheet" href="/css/base.css">
<link rel="stylesheet" href="/css/components.css">
<link rel="stylesheet" href="/css/layout.css">
<link rel="stylesheet" href="/css/pages.css">
<link rel="stylesheet" href="/css/dashboard.css">  <!-- if on dashboard -->
```

### 2. Use Design Tokens
```css
background: var(--jade);
padding: var(--sp-4);
transition: all var(--t-base);
box-shadow: var(--shadow-card);
```

### 3. Use Utility Classes
```html
<div class="text-muted">Muted text</div>
<p class="text-center">Centered paragraph</p>
<div class="transition-all">Smooth transitions</div>
```

### 4. Combine Components
```html
<button class="btn btn-jade animate-fade-up delay-2">
  Click me
</button>
```

---

## Responsive Mobile-First Pattern

```css
/* Mobile (320px+) */
.element {
  font-size: 14px;
  padding: 1rem;
  grid-template-columns: 1fr;
}

/* Tablet (640px+) */
@media (min-width: 640px) {
  .element {
    font-size: 16px;
    padding: 1.5rem;
    grid-template-columns: 1fr 1fr;
  }
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
  .element {
    grid-template-columns: 1fr 1fr 1fr;
  }
}
```

---

## Animation Best Practices

### Fade In Effect
```html
<div class="animate-fade-up delay-1">Content</div>
```

### Stagger Children
```html
<div class="grid">
  <div class="tile animate-fade-up delay-1"></div>
  <div class="tile animate-fade-up delay-2"></div>
  <div class="tile animate-fade-up delay-3"></div>
</div>
```

### Hover Effects
```css
.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lift);
}
```

---

## Accessibility Features

- ✅ Semantic HTML (`<h1>`, `<button>`, etc.)
- ✅ Focus visible states (2px outline, 2px offset)
- ✅ Sufficient color contrast (WCAG AA)
- ✅ Touch-friendly button sizes (48px min)
- ✅ Prefers-reduced-motion support
- ✅ Proper button/link styling for keyboard navigation
- ✅ Form labels with `<label>` elements
- ✅ Error messages with aria-live regions

---

## Production Checklist

Before deploying:
- [ ] All design tokens used consistently
- [ ] No hardcoded colors outside of tokens
- [ ] Mobile layout tested on 320px width
- [ ] Touch targets ≥ 48px
- [ ] Animations use `prefers-reduced-motion`
- [ ] Forms have proper labels
- [ ] Buttons have focus states
- [ ] Images have alt text
- [ ] Performance: no unnecessary animations
- [ ] Dark mode ready (future enhancement)

---

## File Size Summary

| File | Size | Purpose |
|------|------|---------|
| tokens.css | 2 KB | Design tokens |
| base.css | 4 KB | Typography & reset |
| components.css | 12 KB | UI components |
| layout.css | 7 KB | Navigation & page layout |
| pages.css | 6 KB | Common page patterns |
| dashboard.css | 5 KB | Dashboard page |
| features.css | 8 KB | Feature pages |
| profile.css | 7 KB | Profile pages |
| admin.css | 9 KB | Admin panel |
| auth.css | 8 KB | Login/Register |
| content.css | 9 KB | Content pages |
| **Total** | **77 KB** | **All CSS (uncompressed)** |

*With gzip compression: ~20-25 KB*

---

## Future Enhancements

- [ ] Dark mode styles
- [ ] Print media queries
- [ ] CSS custom properties fallbacks
- [ ] Reduced animation variants
- [ ] High contrast mode support
- [ ] RTL language support
- [ ] Theming system

---

*Last updated: April 2026*
*Architecture: Mobile-First, Component-Driven*
*Browser Support: Modern browsers with CSS Grid & Flexbox*
