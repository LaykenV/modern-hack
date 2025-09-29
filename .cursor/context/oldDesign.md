## Design system baseline

This guide summarizes the core tokens, utilities, and UI patterns used across `app/globals.css`, account pages (`app/account/*`), and `components/ModelPicker.tsx`. Use it as the baseline when styling the landing page and other new pages.

### Tokens and themes
- **Fonts**: `--font-sans`, `--font-mono`
- **Radius**: `--radius: 0.625rem`
- **Core color tokens** (light/dark pairs exist via `:root` and `.dark`):
  - **background / foreground**: page background and text
  - **card / card-foreground**: surface background for cards
  - **popover / popover-foreground**: menus, overlays
  - **primary / primary-foreground**: brand blue and on-primary text
  - **secondary / secondary-foreground**: neutral surfaces
  - **accent / accent-foreground**: subtle surface accents
  - **destructive / destructive-foreground**: error/danger actions
  - **border, input, ring**: borders, inputs, focus rings
  - **sidebar tokens**: `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border`, `--sidebar-ring`
- **Gradient tokens**:
  - `--sidebar-gradient-start/end`, `--chat-gradient-start/end`

### Global layout and accessibility
- **Full-height app**: `html, body, #__next` and providers are locked to 100dvh with `overflow: hidden` (content sections scroll within their panes)
- **Focus**: `*:focus-visible` uses a prominent 2px ring (`--ring`)
- **Motion**: short, smooth transitions on interactive elements (0.18–0.2s)
- **Mobile ergonomics**: enforce 16px min font on inputs to avoid iOS zoom

### Page surfaces
- **Account gradient page background**: `account-gradient` (light/dark radial + linear blend)
- **Header bar**: `account-header` for sticky header within account pages
- **Chat/Sidebar gradients**: `brand-sidebar`, `brand-chat` apply subtle gradients with stronger shadows in light mode and softer in dark mode

### Cards and surfaces
- **Section card (general purpose)**: `section-card`, `section-card-title`
- **Model card**: `model-card`, `model-card-wide`, `model-card-selected`
- **Upgrade card**: `upgrade-card`, `upgrade-pill`, `upgrade-progress-track`, `upgrade-progress-fill`
- **Pricing card**: `pricing-card`, `pricing-card-featured`, `pricing-card-current`
- **Menu/inputs surfaces**: `surface-input`, `surface-trigger`, `surface-menu`

Usage guidance:
- Use `section-card` for most informational content tiles and settings blocks
- Use `model-card` variants for selectable, stateful items; apply `model-card-selected` when chosen
- Use `upgrade-card` for promotional/usage widgets; pair with `upgrade-pill` and progress track/fill
- Use `pricing-card` variants for plan selection; `*-featured` emphasizes the best plan

### Navigation and tabs
- **Route tabs**: `route-tabs`, `route-tab`, `route-tab--active` with subtle gradients and borders
- **Floating header**: `floating-header` container for compact elevated header elements

### Buttons
- **Generic variants**: `btn-primary`, `btn-secondary`, `btn-destructive`
- **Prominent CTA**: `btn-new-chat` (full), `btn-new-chat-compact` (compact). Compact is also used for elevated outline CTAs
- **Pricing CTAs**: `btn-pricing`, plus variants `btn-pricing-primary`, `btn-pricing-featured`, `btn-pricing-outline`, `btn-pricing-current`
- **OAuth button**: `btn-oauth` with brand variant `btn-oauth--google` and helper `oauth-icon`
  - Responsive, accessible, high-contrast button suitable for sidebar and dialogs
  - Light mode: luminous layered gradient with subtle brand tint; Dark mode: elevated dark surface
  - Always include the Google mark inside `oauth-icon` for crisp framing across themes

### Badges and pills
- **Primary badge**: `badge-primary` (inline, on-brand)
- **File/reasoning badge**: `badge-file`
- **Selectable set badge**: `badge-set-primary`
- **Generic pill**: `pill`, plus status variants `pill-success`, `pill-danger`

### Progress and stats
- **Track/fill**: `upgrade-progress-track` with `upgrade-progress-fill`
- **Danger fill**: `danger-progress` when in error/over-limit states
- **Stats**: `stats-row` (responsive row/grid), `stat-pill`, `stat-pill-label`, `stat-pill-value`

### Tables
- **Summary table**: `summary-table` with helper column classes `summary-col-*` and chip helpers `table-chip*`, `table-tile*`

### Modals
- **Overlay**: `modal-overlay` with blur + fade-in
- **Card**: `modal-card` with pop-in animation; `modal-close` control
  - Auth dialog uses `modal-card` with header, description, and OAuth button
  - Mobile-friendly padding: `p-4` on xs, `p-6` on sm+

### Chat primitives
- **User message**: `user-bubble` (light elevated surface)
- **Assistant text**: `assistant-text`
- **Attachments**: `attachment-card`, `attachment-card-user`, `attachment-image`
- **Content spacing**: `chat-content`

### Scrolling and scrollbars
- **Hidden scrollbar (chat panes)**: `chats-scroll`
- **Generic custom scrollbar**: `custom-scrollbar`
- **Utility to hide scrollbar (mobile carousels)**: `scrollbar-hide`

### Subscription & usage patterns
- **Accordion**: `subscription-accordion`, `subscription-accordion-header`, `subscription-accordion-content`; toggled class `accordion-open`
- **Mobile pricing carousel**: horizontal scroll container with `snap-x snap-mandatory`, indicators below; desktop switches to 3-column grid
- **Usage panel**: `section-card` with stats row and `upgrade-progress-*` for progress; `info-banner` for inline notes

### ModelPicker patterns
- **Dropdown trigger and menu**: trigger uses `surface-trigger`; content uses `surface-menu`
- **Selected panel**: shows master model with `badge-primary`; optional secondaries (max 2)
- **Drag-and-drop**: draggable `model-card` tiles; master and secondary drop zones use bordered containers that highlight with `border-primary/60` on hover/over
- **Selection states**: primary/secondary selections use `model-card-selected`; disabled states use `cursor-default opacity-90`
- **Feature badges**: `badge-file` and reasoning badge (also uses `badge-file` style)
- **Usage widget**: inline `upgrade-card` inside menu for plan/usage quick view
- **Logos**: prefer theme-aware assets (dark/light) and swap using the resolved theme when mounted to avoid flicker

### Accessibility and interaction
- **Focus-visible** rings on all interactive elements
- **Hover gating**: for hover-only behaviors (like opening accordions on desktop), gate with `(hover: hover) and (pointer: fine)`; click toggles remain for touch
- **Transitions**: keep interactions snappy (≈180–200ms) and consistent

### Responsive conventions
- **Breakpoints**: mobile-first; progressively enhance at `sm`, `md`, `lg`
- **Component variants**: some components render distinct mobile/desktop layouts (e.g., ModelPicker’s `ModelCardMobile` vs `ModelCardDesktop`, pricing carousel vs grid)

### Layout recipe (recommended starting point)
Use this structure for new pages with a floating header and scrollable content area inside a full-height gradient surface:

```tsx
// Top-level page container
<div className="h-full account-gradient">
  <div className="mx-auto max-w-6xl h-full flex flex-col">
    <header className="account-header sticky top-0 z-10">
      <div className="px-4 sm:px-6 py-3">
        {/* Tabs / nav / actions */}
      </div>
    </header>
    <main className="flex-1 overflow-auto px-4 sm:px-6 pb-8 pt-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="section-card p-6">
          <h2 className="section-card-title mb-4">Section title</h2>
          {/* Content */}
        </div>
      </div>
    </main>
  </div>
  
</div>
```

### Do/Don’t
- **Do** use `section-card` for most content blocks; use `model-card` only for selectable tiles
- **Do** use `surface-trigger` and `surface-menu` for dropdowns/popovers to match elevated surfaces
- **Do** respect light/dark tokens; never hardcode colors—use semantic classes or CSS variables-driven utilities
- **Do** keep progress and stats consistent with `upgrade-progress-*` and `stat-pill*`
- **Don’t** introduce new shadow or border styles—reuse existing utilities
- **Don’t** rely on page-level scrolling; scroll inside the content area (`overflow-auto` on `main`)

### Quick reference: frequently used utilities
- **Text**: `text-muted-foreground`, `font-medium`, `font-semibold`
- **Spacing**: `space-y-6` for vertical rhythm between sections
- **Containers**: `max-w-6xl` page, `max-w-5xl` content
- **Borders**: `border`, `border-border`, interactive emphasis with `border-primary/40–60`
- **Elevation**: use provided card/surface classes instead of custom shadows

This baseline captures the styling language already used across account pages and the ModelPicker. Build new pages by composing these tokens and utilities to preserve visual consistency.

