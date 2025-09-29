## Atlas Design System (v3 - Warm & Bold)

### Goals
- Elevate visual impact with a vibrant red-orange palette and warm neutrals.
- Replace cold blue/purple tints with beautiful off-white and off-black bases.
- Create cohesive gradients using warm tones that flow naturally throughout the app.
- Maintain high contrast and accessibility while feeling energetic and modern.
- **Enhanced Light Mode**: Dramatically increased contrast ratios, deeper saturated primary colors, and clearly defined surface hierarchy for stunning visual impact.

### Brand Anchors
- **Ember Red-Orange**: Intensely vibrant, confident primary for actions and focus (`hsl(12 94% 52%)` light, `hsl(15 88% 60%)` dark).
- **Warm Amber**: Rich analogous accent for gradients and highlights, creating smooth transitions.
- **Cream (Off-White)**: Warm, inviting neutrals with enhanced saturation for light mode structure.
- **Charcoal (Off-Black)**: Rich, deep darks with minimal warm tint for sophisticated dark mode.

Supporting neutrals derive from warm hues (no blue/purple/gray tints):
- Cream raises (lightens) for surfaces and cards with increased saturation.
- Charcoal deepens for dark cards and outlines with enhanced contrast.
- Red-Orange 52% with 94% saturation for powerful primary fill in light mode, 60% in dark mode.
- Warm tones flow from peach → orange → red-orange with higher saturation for gradient variety.

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
- Background: `32 45% 99%` - crisp warm off-white with enhanced warmth
- Foreground: `20 30% 6%` - rich deep charcoal for maximum contrast
- Primary: `12 94% 52%` - intensely vibrant red-orange
- Ring: `14 95% 48%` - vivid red-orange for focus states
- Border: `25 32% 62%` - visible warm borders with strong definition
- Surface-muted: `30 40% 92%` - distinct secondary surfaces
- Muted-foreground: `22 25% 32%` - clear supporting text with strong contrast
- Radials: Red-orange `12°` → Amber `25°` → Gold `38°` with enhanced saturation

#### Dark Mode Values
- Background: `20 15% 8%` - rich dark with subtle warm tint
- Foreground: `30 10% 96%` - clean off-white
- Primary: `15 88% 60%` - bright red-orange (lifted saturation)
- Ring: `18 92% 62%` - vivid red-orange for focus
- Radials: Red-orange `15°` → Amber `25°` → Gold `35°` for warm overlays

### Layout Surfaces
- **Landing Page**: Vertical blends with large, faint warm radial accents; cards rest on `--surface-raised`. Header uses gradient tokens for a crisp edge.
- **Dashboard**:
  - Sidebar: Warm gradient (cream → light amber) with subtle inner edge glow; `--sidebar-border` separates content.
  - Header: Slim, sticky bar using header gradient tokens; 1px border-bottom for definition.
  - Content Area: Vertical gradient from warm cream to slightly deeper peach so cards pop.
- Spacing rooted in Tailwind defaults; base radius `--radius: 0.625rem`.

Use utilities for surfaces:
- `bg-sidebar-gradient` or `bg-sidebar-gradient-radial` for the shell.
- `bg-header-gradient` or `bg-header-gradient-radial` for top bars.
- `bg-page-gradient` or `bg-page-gradient-radial` for content areas.

### Component Guidelines
- **Cards**
  - Default card: Soft warm gradient (cream → lighter cream) with `--shadow-soft`.
  - Featured card: Adds an Ember red-orange border and faint radial accent; use `--shadow-strong` sparingly.
  - Content cards respect padding scale (`p-6` default, `p-4` compact).
- **Buttons**
  - Primary: Ember red-orange gradient blending into warmer amber accent; hover increases saturation and lifts shadow.
  - Secondary: Warm neutral fill with diagonal shimmer; hover raises contrast.
  - Ghost / tertiary: Transparent background, emphasize text + focus ring.
  - Destructive: Red tone derived from palette (`hsl(0 74% 52%)` light, `hsl(0 84% 64%)` dark).
  - States: Focus ring uses `--ring`; disabled lowers opacity and removes elevation.
- **Inputs & Selects**
  - Base fill `--surface-muted`, inner shadow to hint depth, 2px focus ring.
  - For grouped fields, use soft 1px dividers and consistent padding.
- **Badges & Pills**
  - Primary badge: Primary→accent gradient with white text; secondary badge uses warm muted with `--muted-foreground`.
- **Navigation Tabs / Chips**
  - Use accent surface with active state shifting toward primary gradient and slight expansion.
- **Alerts & Banners**
  - Info: Accent gradient with red-orange border.
  - Success: Subtle green (`hsl(150 42% 42%)`).
  - Warning / Destructive: Align with red/orange derived tokens.

### Motion & Interaction
- Standard transition speed: 180ms cubic-bezier(0.22, 0.61, 0.36, 1).
- Cards + buttons elevate on hover (translateY(-1px to -3px) max).
- Gradient surfaces fade between themes using opacity transitions.
- Use `prefers-reduced-motion` queries to reduce transforms and rely on opacity.

### Gradient Philosophy
Warm gradients flow naturally using hue shifts:
- **Subtle**: Shift 5-10° within the warm spectrum (25° → 30° → 35°).
- **Moderate**: Shift 10-20° for more dynamic blends (12° → 25° → 38°).
- **Bold**: Use primary red-orange with radial overlays at slightly warmer hues.

Avoid jumping from warm to cool tones; maintain warmth throughout for cohesion.

### Implementation Notes
- `app/globals.css` contains tokens, base resets, and shared utilities. Component utilities should be authored per feature folder using this plan.
- When adding new utilities, prefix by component (`.btn-*`, `.card-*`) and document them here.
- Prefer Tailwind classes that hook into the CSS variables (e.g., `bg-[hsl(var(--surface-raised))]`).

### Color Palette Reference

#### Light Mode
| Token | HSL | Purpose |
|-------|-----|---------|
| Background | `32 45% 99%` | Crisp warm off-white base |
| Foreground | `20 30% 6%` | Rich charcoal text (high contrast) |
| Primary | `12 94% 52%` | Intensely vibrant ember red-orange |
| Accent | `28 75% 86%` | Rich warm amber accent |
| Border | `25 32% 62%` | Strong visible warm borders |
| Surface-raised | `32 42% 96%` | Elevated card surface |
| Surface-muted | `30 40% 92%` | Recessed/secondary surface |
| Muted-foreground | `22 25% 32%` | Supporting text (strong contrast) |

#### Dark Mode
| Token | HSL | Purpose |
|-------|-----|---------|
| Background | `20 15% 8%` | Rich off-black |
| Foreground | `30 10% 96%` | Clean off-white |
| Primary | `15 88% 60%` | Bright red-orange |
| Accent | `20 50% 22%` | Deep warm accent |
| Border | `20 12% 28%` | Warm dark borders |

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
  <Link href="/path" className="btn-contrast inline-flex mt-4">
    Create First Item
  </Link>
</div>
```

#### Button Styles

**Primary Action:**
```tsx
<button className="btn-contrast">
  Primary Action
</button>
```

**Text Link:**
```tsx
<Link className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
  Link Text →
</Link>
```

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
10. **Consistent CTAs** - Use `btn-contrast` for primary buttons, primary-colored links for secondary actions
11. **Responsive gaps** - Use smaller gaps on mobile (`gap-3`) and larger on desktop (`gap-6`) for better space utilization

### Next Steps
1. Apply these patterns to remaining dashboard pages (Marketing, Calls, Meetings, etc.)
2. Create page-specific variants while maintaining core design system
3. Test contrast ratios to ensure accessibility standards are met
4. Document any new patterns that emerge as edge cases are discovered