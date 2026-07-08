# OneDayPilot — Redesign Notes

A clean, presentation-ready aesthetic upgrade. **All functions, props, Supabase keys, state logic, event handlers, and Cart/Wizard wiring are untouched.** Only visual layer — shapes, typography, motion, colors that aren't from Supabase — has been refined.

---

## Aesthetic Direction

**"Aviation Boarding Pass × Flight Deck"** — premium, technical, calm.

- **Primary Red:** `#CC1F1F` (your brand red — unchanged)
- **Secondary Red:** `#FF4444` (accent / gradient highlight)
- **Deep Slate:** `#0F172A` / `slate-900` (replaces flat black)
- **Soft Backgrounds:** `#FAFBFC` → `#F4F6FA` gradient meshes (replaces stark white)
- **Sky Navy:** `#0B1424` (hero fallback — replaces sky blue)

Red and white still dominate. Slate is used only for neutrals so nothing looks "boring black + boring white."

---

## Typography (3-font system)

Add these to your `index.html` `<head>` once (you likely already have Bebas Neue + Barlow):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

- **Bebas Neue** — display headlines, prices, slide counters (ticket-stub feel)
- **Barlow Condensed** — eyebrows, buttons, technical labels (HUD feel)
- **Plus Jakarta Sans** — body copy, FAQ text, paragraphs (modern, friendly, not generic Inter/Roboto)

---

## What Was Redesigned (per file)

### `Header.tsx`
- Refined glassmorphism (blur + saturate) instead of plain backdrop blur
- Nav items now sit in a pill-shaped container with rounded "active" red chip
- "Book Flight" CTA: gradient pill with airplane icon in a sub-circle + shimmer sweep on hover
- Mobile menu opens with boarding-pass perforation strip + numbered items (01, 02, ...)
- Scroll progress bar redesigned to a runway-light gradient
- **Functions/Supabase keys/state — untouched**

### `HeroCarousel.tsx`
- Cinematic multi-stop gradient overlays instead of dark slab
- Top HUD strip: "LIVE · WMSA · SUBANG" + coordinates
- Eyebrow with crosshair marker
- Slide counter now a glass card on the right (XX OF YY in Bebas)
- Progress bars at bottom that fill with `motion.span` as the slide auto-advances
- Buttons: gradient pill + airplane icon, shimmer sweep
- "Scroll" hint at the bottom
- **Auto-rotate logic, trackEvent, supabase keys, button style props — untouched**

### `PricingSection.tsx`
- Cards now use **`whileInView`** scroll-triggered reveals (stagger by index)
- Top of each category card has a 3px red gradient runway stripe
- Boarding-pass dashed dividers between sections
- Price displayed in **Bebas Neue** at 2rem with small "RM" superscript — looks like an airline fare
- "Add" button: pill, slate-900 → red on hover
- Subtle grid background pattern + red glow blob
- **`addItem`, supabase fetch, sort_order logic, category resolution — untouched**

### `StarWarsSection.tsx`
- Cleaner cinematic crawl — softer letter-bounce animation (no more 5-axis wobble)
- Eyebrow "PRE-FLIGHT BRIEFING" + crosshair markers
- "FLIGHT BRIEFING · 001" HUD frame at top
- Bottom tap-hint moved out of the way
- "TAP & HOLD TO READ" prompt at the bottom (improves UX clarity)
- Divider line is now a glowing red dot with fading hairlines either side (instead of a chunky bar)
- **isManualScroll touch handlers, audio system, intersection observer, mute event — untouched**

### `ContactSection.tsx`
- Left card is a **literal boarding pass**: top runway stripe → "OPS · PASS / GATE H3" header → 4 info rows in icon-pill format → perforation strip → operating hours panel
- Right map: floating "LIVE · SUBANG AIRFIELD · WMSA" strip + corner crosshair brackets
- Scroll-triggered fade-up reveals
- **groupBusinessHours, supabase keys, iframe src, contact data — untouched**

### `FloatingCart.tsx`
- Trigger button is now a true spring-animated FAB (smaller, more premium)
- Sheet panel: red runway stripe top + dashed perforation dividers (top + bottom)
- Items render in soft rounded cards with image rings
- Add-ons indent with elbow connector lines (visual hierarchy)
- Quantity buttons in pill toggles
- Total displayed in Bebas Neue 2.25rem
- Checkout button: gradient pill, airplane icon
- **All cart logic, removeItem, updateQuantity, navigation, BookingWizard event — untouched**

### `FloatingSupport.tsx`
- FAQ panel: red gradient header with subtle radial highlight
- Each question gets a numbered prefix (01, 02, ...) + chevron pill that turns red when open
- Smooth height animation on expand
- Speaker toggle is now a small white pill with red ring when active
- Main FAB: spring scale, ping ring, switches from green → slate when open
- **whatsappNumber supabase fetch, FAQ_ITEMS, audio event dispatch — untouched**

### `WhatsAppConnector.tsx`
- Status pill with animated ping dot
- QR card has runway stripe + smartphone icon header
- Offline state has a proper "empty" card with icon
- Action button uses gradient when offline, white-bordered when connected
- **API_URL fallback chain, polling intervals, Supabase fallbacks — untouched**

### `NavLink.tsx`
- Pure functional wrapper — nothing visual to redesign. **Kept as-is.**

---

## Removing Section-to-Section Page Transitions

You asked to remove transitions when scrolling section to section. The components themselves use `whileInView` (scroll-triggered enter reveals **only the first time**, then static). The remaining "page transition" feel likely comes from a router-level wrapper, typically `AnimatePresence` in your `App.tsx` or a `<PageTransition>` HOC.

**Find and remove the route-level wrapper.** Look in your `App.tsx` / `Layout.tsx` for something like:

```tsx
// REMOVE this kind of pattern
<AnimatePresence mode="wait">
  <motion.div
    key={location.pathname}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
  >
    <Outlet />
  </motion.div>
</AnimatePresence>

// Replace with simply:
<Outlet />
```

The new components use `viewport={{ once: true }}` so each section reveals **once on entry** and stays static — no re-animating as you scroll back and forth.

---

## Drop-In Instructions

1. Add the Google Fonts `<link>` to `index.html` (see Typography section).
2. Replace the 9 files in `src/components/` with the matching files from this folder.
3. (Optional) Remove route-level `AnimatePresence` wrapper from `App.tsx`.

No changes to: Supabase schema, Cart context, BookingWizard, lib/analytics, ui/button, ui/sheet, ui/scroll-area, ui/badge — all untouched.
