## Atlas Design System (v4 - Clean & Vibrant)

### Goals
- Create a refined, modern aesthetic with clean off-white and off-black bases.
- Use a vibrant orange/red as the hero accent that commands attention.
- Maintain subtle warmth in neutrals without feeling brown or muddy.
- Ensure excellent contrast and readability in both light and dark modes.
- Let the orange accent be the star - neutrals should be elegant and understated.

### Brand Anchors
- **Vibrant Orange**: Pure, electric hero color for actions and focus (`hsl(14 100% 55%)` light, `hsl(16 98% 62%)` dark).
- **Off-White**: Clean, barely-there warm white for light mode (`hsl(30 8% 98%)`).
- **Off-Black**: Rich, sophisticated dark for dark mode (`hsl(20 8% 7%)`).
- **Neutral Grays**: Desaturated warm grays (6-10% saturation) for surfaces and text.

Color Philosophy:
- Backgrounds and neutrals stay desaturated (6-10% saturation max) to feel clean, not brown.
- Only the primary orange uses high saturation (95-100%) to create stunning visual impact.
- Subtle warm hue (20-30°) in neutrals prevents coldness without muddiness.
- Gradients flow within tight hue ranges for cohesion (14° → 20° → 26°).

### Semantic Token Map
Tokens live in `:root` and `.dark` within `app/globals.css`.

#### Core Tokens
- `--background` / `--foreground`: page background and primary text.
- `--surface-muted`: low-contrast fill for dividers, secondary panels.
- `--surface-raised`: default card background.
- `--surface-overlay`: popovers, modals, command palette.
- `--border`, `--input`, `--ring`: structural strokes and focus.
- `--primary` / `--primary-foreground`: Ember red-orange call to action.
- `--accent` / `--accent-foreground`: Warm amber-tinted neutral for highlights.
- `--muted` / `--muted-foreground`: subdued backgrounds and supporting text.

#### Layout Tokens
- Sidebar gradient: `--sidebar-gradient-start`, `--sidebar-gradient-end`, plus `--sidebar-border`, `--sidebar-foreground`.
- Header gradient: `--header-gradient-start`, `--header-gradient-end`.
- Content gradient: `--content-gradient-start`, `--content-gradient-mid`, `--content-gradient-end`.
- Radial overlays: `--radial-1`, `--radial-2`, `--radial-3` for subtle warm glows.

#### Light Mode Values
- Background: `30 8% 98%` - pristine off-white with whisper of warmth
- Foreground: `20 10% 10%` - rich near-black for crisp text
- Primary: `14 100% 55%` - electric vibrant orange
- Ring: `14 100% 52%` - vivid orange for focus states
- Border: `30 8% 70%` - subtle warm gray borders
- Surface-raised: `30 8% 97%` - barely elevated surface
- Surface-muted: `30 6% 94%` - recessed secondary surface
- Muted-foreground: `20 6% 40%` - clear supporting text
- Radials: Orange `14°` → Warm Orange `20°` → Amber `26°` with full saturation

#### Dark Mode Values
- Background: `20 8% 7%` - sophisticated near-black
- Foreground: `30 6% 95%` - clean off-white
- Primary: `16 98% 62%` - brilliant orange (brighter for dark backgrounds)
- Ring: `16 100% 58%` - vivid orange for focus
- Border: `20 6% 26%` - refined dark gray
- Surface-raised: `20 8% 9%` - slightly lifted surface
- Surface-muted: `20 6% 12%` - deeper recessed surface
- Muted-foreground: `25 5% 65%` - comfortable supporting text
- Radials: Orange `16°` → Warm Orange `22°` → Amber `28°` with high saturation

### Layout Surfaces
- **Landing Page**: Clean off-white base with subtle radial orange accents; cards rest on `--surface-raised` with minimal gradient. Header uses gradient tokens for definition.
- **Dashboard**:
  - Sidebar: Gentle gray gradient (off-white → slightly darker) with refined border; orange accents only on active states.
  - Header: Slim, sticky bar with subtle gradient; crisp 1px border for separation.
  - Content Area: Very subtle gradient from light gray to slightly deeper - keeps focus on content and orange CTAs.
- Spacing rooted in Tailwind defaults; base radius `--radius: 0.625rem`.
- Orange color reserved for interactive elements (buttons, links, active states) to maximize impact.

Use utilities for surfaces:
- `bg-sidebar-gradient` or `bg-sidebar-gradient-radial` for the sidebar shell.
- `bg-header-gradient` or `bg-header-gradient-radial` for top bars.
- `bg-page-gradient` or `bg-page-gradient-radial` for main content areas.
- Radial overlays use orange hues but at very low opacity (10-14%) to add energy without overwhelming.

### Component Guidelines
- **Cards**
  - Default card: Subtle gray gradient (raised → muted) with `--shadow-soft`.
  - Featured card: Adds vibrant orange border and minimal radial accent; use `--shadow-strong` for emphasis.
  - Content cards respect padding scale (`p-6` default, `p-4` compact).
  - Cards stay neutral to let orange CTAs and active states shine.
- **Buttons**
  - Primary (`.btn-primary`): Vibrant orange gradient (24%-42% opacity) over primary color, inset ring shadow, subtle lift on hover. This is the star CTA throughout the app.
  - Secondary: Clean gray fill with muted background; hover increases contrast slightly.
  - Ghost / tertiary: Transparent background with orange text on hover, emphasize focus ring.
  - Destructive: Red tone derived from palette (`hsl(0 84% 55%)` light, `hsl(0 86% 64%)` dark).
  - States: Focus ring uses vivid `--ring` (orange); disabled lowers opacity and removes elevation.
  - Legacy: `.btn-contrast` is aliased to `.btn-primary` for backwards compatibility.
- **Inputs & Selects**
  - Base fill `--surface-muted`, inner shadow for depth, vibrant orange 2px focus ring.
  - For grouped fields, use soft 1px dividers and consistent padding.
- **Badges & Pills**
  - Primary badge: Orange gradient with white text; secondary badge uses neutral gray with `--muted-foreground`.
- **Navigation Tabs / Chips**
  - Neutral gray default with active state using full orange gradient treatment and slight expansion.
- **Alerts & Banners**
  - Info: Neutral gray with orange accent border.
  - Success: Subtle green (`hsl(150 65% 42%)` light, `hsl(150 55% 62%)` dark).
  - Warning / Destructive: Align with orange/red derived tokens.

### Motion & Interaction
- Standard transition speed: 180ms cubic-bezier(0.22, 0.61, 0.36, 1).
- Cards + buttons elevate on hover (translateY(-1px to -3px) max).
- Gradient surfaces fade between themes using opacity transitions.
- Use `prefers-reduced-motion` queries to reduce transforms and rely on opacity.

### Gradient Philosophy
Clean, refined gradients that enhance without overwhelming:
- **Neutral Surfaces**: Very tight hue range (28° → 30° → 32°) with low saturation (6-10%) for subtle depth.
- **Orange Accents**: Focused hue range (14° → 20° → 26°) with high saturation (90-100%) for vibrant CTAs.
- **Radial Overlays**: Orange hues at very low opacity (10-16%) to add energy without competing with content.

Key principle: Neutrals stay quiet and elegant, orange bursts with energy. No muddy in-between browns.

### Implementation Notes
- `app/globals.css` contains tokens, base resets, and shared utilities. Component utilities should be authored per feature folder using this plan.
- When adding new utilities, prefix by component (`.btn-*`, `.card-*`) and document them here.
- Prefer Tailwind classes that hook into the CSS variables (e.g., `bg-[hsl(var(--surface-raised))]`).

### Color Palette Reference

#### Light Mode
| Token | HSL | Purpose |
|-------|-----|---------|
| Background | `30 8% 98%` | Pristine off-white base |
| Foreground | `20 10% 10%` | Rich near-black text (maximum contrast) |
| Primary | `14 100% 55%` | Electric vibrant orange hero color |
| Accent | `30 10% 88%` | Subtle warm gray accent |
| Border | `30 8% 70%` | Refined warm gray borders |
| Surface-raised | `30 8% 97%` | Barely elevated card surface |
| Surface-muted | `30 6% 94%` | Recessed/secondary surface |
| Muted-foreground | `20 6% 40%` | Supporting text (clear hierarchy) |

#### Dark Mode
| Token | HSL | Purpose |
|-------|-----|---------|
| Background | `20 8% 7%` | Sophisticated near-black |
| Foreground | `30 6% 95%` | Clean off-white |
| Primary | `16 98% 62%` | Brilliant orange (optimized for dark) |
| Accent | `20 8% 20%` | Deep neutral accent |
| Border | `20 6% 26%` | Refined dark gray borders |
| Surface-raised | `20 8% 9%` | Slightly elevated surface |
| Surface-muted | `20 6% 12%` | Deeper recessed surface |
| Muted-foreground | `25 5% 65%` | Comfortable supporting text |

### Dashboard Page Patterns & Reusable Components

This section documents the proven patterns from the Dashboard Overview page that should be reused across all dashboard pages for consistency.

#### Page Structure Template

```tsx
export default function PageName() {
  return (
    <main className="min-h-full p-6 md:p-8 flex flex-col gap-6">
      {/* Page content - background gradient comes from layout */}
      <div className="max-w-6xl mx-auto w-full space-y-8">
        {/* Cards and sections here */}
      </div>
    </main>
  );
}
```

**Key Points:**
- Layout (`app/dashboard/layout.tsx`) applies `bg-page-gradient-radial` to `SidebarInset` with `overflow-hidden`
- Page content uses `p-6 md:p-8` for consistent spacing
- Max-width container (`max-w-6xl mx-auto`) centers content
- Sections use `space-y-8` for vertical rhythm

#### Reusable Card Classes

**1. `.card-warm-static`** - Default card for content sections
- Use for: Headers, content groups, list containers
- Features: Subtle gradient, soft shadow, no hover effect
```tsx
<div className="card-warm-static p-6 md:p-8">
  {/* Section content */}
</div>
```

**2. `.card-warm`** - Interactive card with hover lift
- Use for: Clickable cards, interactive elements
- Features: Hover transform, shadow elevation, border highlight
```tsx
<div className="card-warm p-6">
  {/* Interactive content */}
</div>
```

**3. `.card-warm-accent`** - Featured card with accent tint
- Use for: Important sections, highlighted content
- Features: Warm accent gradient, primary border tint
```tsx
<div className="card-warm-accent p-6 md:p-8">
  {/* Featured content */}
</div>
```

#### Stat Card Pattern

Use for displaying key metrics in grid layouts:

```tsx
type StatCardProps = {
  title: string;
  value: number;
  subtitle: string;
  variant: "primary" | "accent";
};

function StatCard({ title, value, subtitle, variant }: StatCardProps) {
  const cardClass = variant === "primary" ? "stat-card-primary" : "stat-card-accent";
  
  return (
    <div className={`${cardClass} p-5`}>
      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        {title}
      </p>
      <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
      <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>
    </div>
  );
}

// Usage:
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
  <StatCard title="Metric Name" value={123} subtitle="Description" variant="primary" />
  <StatCard title="Metric Name" value={45} subtitle="Description" variant="accent" />
</div>
```

**Variants:**
- `primary` - Red-orange accent, use for most important metric
- `accent` - Warm neutral, use for supporting metrics

#### Action Link Pattern

Use for navigational quick actions:

```tsx
<Link href="/path" className="action-link">
  <div className="action-link-icon">
    <span className="text-3xl">🎯</span>
  </div>
  <span className="font-semibold text-foreground text-center">Action Title</span>
  <span className="text-sm text-muted-foreground text-center mt-2">
    Description text
  </span>
</Link>

// Layout:
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
  {/* Action links */}
</div>
```

**Features:**
- Vibrant primary gradient icon background
- 3px hover lift with shadow
- Accent tint on hover
- Responsive grid (2 col mobile → 4 col desktop)

#### List Item Cards Pattern

Use for displaying lists within sections (campaigns, calls, etc.):

```tsx
<div className="space-y-3">
  <div className="flex items-center justify-between p-4 rounded-lg bg-surface-overlay/50 border border-border/40 hover:border-border transition-colors">
    <div className="flex-1">
      <p className="font-semibold text-foreground">Item Title</p>
      <p className="text-sm text-muted-foreground mt-1">Subtitle or details</p>
    </div>
    <div className="text-right ml-4">
      <StatusBadge status="active" />
      <p className="text-xs text-muted-foreground mt-2">Date info</p>
    </div>
  </div>
</div>
```

#### Status Badge Pattern

Use for displaying status indicators:

```tsx
<span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-primary/20 text-primary border border-primary/30">
  Active
</span>
```

**Semantic Status Colors:**
- Running/In-Progress: `bg-accent/60 text-accent-foreground border-accent-foreground/20`
- Completed: `bg-primary/20 text-primary border-primary/30`
- Paused: `bg-muted text-muted-foreground border-border`
- Failed/Error: `bg-destructive/20 text-destructive border-destructive/30`

#### Hero Section Pattern

Use at top of each page for title + key info:

```tsx
<div className="card-warm-static p-6 md:p-8">
  <div className="flex items-center gap-6 mb-8">
    {/* Optional: Avatar or icon */}
    <div>
      <h1 className="text-4xl font-bold text-foreground tracking-tight">
        Page Title
      </h1>
      <p className="text-muted-foreground mt-2 text-lg">
        Page description or context
      </p>
    </div>
  </div>
  
  {/* Optional: Stats grid or other hero content */}
</div>
```

#### Section Header Pattern

Use for titled content sections:

```tsx
<div className="card-warm-static p-6 md:p-8">
  <div className="flex items-center justify-between mb-6">
    <h2 className="text-2xl font-bold text-foreground">Section Title</h2>
    <Link
      href="/path"
      className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
    >
      View all →
    </Link>
  </div>
  {/* Section content */}
</div>
```

#### Typography Hierarchy

- **Page Title**: `text-4xl font-bold text-foreground tracking-tight`
- **Section Title**: `text-2xl font-bold text-foreground`
- **Card Title**: `text-lg font-semibold text-foreground`
- **Body Text**: `text-base text-foreground`
- **Supporting Text**: `text-sm text-muted-foreground`
- **Labels**: `text-sm font-semibold text-muted-foreground uppercase tracking-wide`
- **Micro Text**: `text-xs text-muted-foreground`

#### Spacing System

- **Page padding**: `p-6 md:p-8`
- **Card padding**: `p-6 md:p-8` (large sections) or `p-4` (compact cards)
- **Section spacing**: `space-y-8` (between major sections)
- **Item spacing**: `space-y-3` (between list items)
- **Element gaps**: `gap-4 md:gap-6` (grids), `gap-6` (flex containers)

#### Grid Patterns

**Stats/Cards Grid (Mobile-Optimized):**
```tsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
```
*2 columns on mobile, 4 columns on large screens*

**Two Column Layout:**
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
```

**Three Column Layout:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
```

#### Mobile Navigation

The dashboard layout includes responsive navigation handling:

**Mobile Header:**
- Fixed header bar visible only on mobile devices
- Includes sidebar toggle button and theme toggle
- Sticky positioning with backdrop blur for modern feel
- Header gradient with subtle border for definition
- Controls inside sidebar are hidden on mobile (no duplication)

**Desktop Navigation:**
- Collapsible sidebar with full navigation menu
- Theme toggle and sidebar trigger visible inside sidebar header
- Floating controls when sidebar is collapsed (desktop only)
- Theme toggle and sidebar trigger in floating panel

**Implementation:**
```tsx
// In layout.tsx - Sidebar header with controls hidden on mobile
<SidebarHeader>
  <div className="flex items-center justify-between px-3 py-2">
    <div className="text-lg font-bold">Atlas Outbound</div>
    {/* Hidden on mobile (md:flex), shown on desktop */}
    <div className="hidden md:flex items-center gap-2">
      <ThemeToggle />
      <SidebarTrigger />
    </div>
  </div>
</SidebarHeader>

// Mobile header shown only on mobile
function MobileHeader() {
  const { isMobile } = useSidebar();
  if (!isMobile) return null;
  return (
    <div className="sticky top-0 z-40 flex items-center justify-between p-4 bg-header-gradient-radial border-b border-[hsl(var(--border)/0.6)] backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <span className="text-lg font-bold">Atlas Outbound</span>
      </div>
      <ThemeToggle />
    </div>
  );
}

// Navigation menu with auto-close on mobile
function NavigationMenu() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNavClick = () => {
    // Close sidebar on mobile when a nav link is clicked
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarMenu className="gap-2.5 p-2">
      {navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton asChild>
            <Link href={item.href} onClick={handleNavClick}>
              {/* Link content */}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
```

**Key Features:**
- Sidebar automatically closes when navigation link is clicked on mobile
- Theme toggle and sidebar trigger hidden inside sidebar on mobile (only shown in mobile header)
- Controls appear inside sidebar header on desktop, hidden on mobile to avoid duplication
- Improves UX by showing content immediately after selection
- No manual close needed on mobile devices

#### Empty State Pattern

Use when sections have no data:

```tsx
<div className="text-center py-8">
  <p className="text-muted-foreground">No items yet</p>
  <Link href="/path" className="btn-primary inline-flex mt-4">
    Create First Item
  </Link>
</div>
```

#### Button Styles

**Primary Action:**
```tsx
<button className="btn-primary">
  Primary Action
</button>
```

**Secondary Action:**
```tsx
<button className="rounded-lg px-4 py-2 text-sm font-semibold border border-border bg-surface-muted text-foreground hover:bg-surface-raised transition-colors">
  Secondary Action
</button>
```

**Text Link:**
```tsx
<Link className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
  Link Text →
</Link>
```

#### Form Field Pattern

Use consistent form field styling throughout the app:

```tsx
<div>
  <label className="input-label">Field Name</label>
  <input 
    type="text" 
    className="input-field" 
    placeholder="Enter value..." 
  />
</div>

<div>
  <label className="input-label">Choose Option</label>
  <Select>
    <SelectTrigger>
      <SelectValue placeholder="Select an option..." />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="option1">Option 1</SelectItem>
      <SelectItem value="option2">Option 2</SelectItem>
    </SelectContent>
  </Select>
</div>
```

**Features:**
- `.input-label` - Consistent label styling (semibold, proper spacing)
- `.input-field` - Text inputs with design system colors, inset shadow, orange focus ring
- `.select-field` - Automatically applied to `SelectTrigger`, matches `.input-field` exactly
- All fields use `bg-surface-muted`, `border-input`, `rounded-lg`
- 2px vibrant orange focus ring (`ring-ring`)
- Inset shadow for depth
- Same height (`py-2.5`) for visual alignment

#### Best Practices

1. **Always use semantic color tokens** - Never hardcode colors; use `text-foreground`, `text-muted-foreground`, `bg-primary`, etc.
2. **Maintain consistent spacing** - Use the spacing system for predictable rhythm
3. **Use appropriate card types** - Static for containers, warm for interactions, accent for features
4. **Follow typography hierarchy** - Larger, bolder text for important headings
5. **Include empty states** - Guide users when sections have no data
6. **Mobile-optimized grids** - Use 2-column grids on mobile for stat cards and quick actions (avoids long vertical scrolling), expand to 4 columns on large screens
7. **Mobile navigation** - Always ensure sidebar toggle is visible on mobile via sticky header; sidebar auto-closes when navigation links are clicked on mobile; hide duplicate controls inside sidebar on mobile (use `hidden md:flex`)
8. **High contrast text** - Use bold weights and foreground colors for readability
9. **Hover states** - Interactive elements should have clear hover feedback
10. **Consistent CTAs** - Use `btn-primary` for primary buttons (matching active tab aesthetic), muted background buttons for secondary actions, primary-colored links for tertiary actions
11. **Responsive gaps** - Use smaller gaps on mobile (`gap-3`) and larger on desktop (`gap-6`) for better space utilization
12. **Form consistency** - Use `.input-label`, `.input-field`, and shadcn Select components (with automatic `.select-field` styling) for all form inputs

### Next Steps
1. Apply these patterns to remaining dashboard pages (Marketing, Calls, Meetings, etc.)
2. Create page-specific variants while maintaining core design system
3. Test contrast ratios to ensure accessibility standards are met
4. Document any new patterns that emerge as edge cases are discovered