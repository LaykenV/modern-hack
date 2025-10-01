# Modal Styling Guidelines

This document provides patterns for creating consistent, theme-aware modals throughout the Atlas application.

## Core Modal Structure

### Dialog Container
```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogPortal>
    <DialogOverlay className="bg-black/95 backdrop-blur-md" />
    <DialogContent className="sm:max-w-[540px] bg-gradient-to-br from-[hsl(var(--surface-raised))] to-[hsl(var(--surface-muted))] border border-[hsl(var(--border)/0.6)] shadow-[var(--shadow-strong)]" showCloseButton={true}>
      {/* Content */}
    </DialogContent>
  </DialogPortal>
</Dialog>
```

**Key Points:**
- **Overlay**: Use `bg-black/95 backdrop-blur-md` for dramatic, intense blur
- **Content Background**: Subtle gradient `from-[hsl(var(--surface-raised))] to-[hsl(var(--surface-muted))]`
- **Border**: `border-[hsl(var(--border)/0.6)]` for soft definition
- **Shadow**: Use design system shadow `shadow-[var(--shadow-strong)]`
- **Max Width**: `sm:max-w-[540px]` for most modals (adjust as needed)

## Modal Header

### Standard Header with Icon
```tsx
<DialogHeader className="space-y-3 pb-2">
  <div className="flex items-center gap-3">
    <div className="p-2.5 rounded-lg bg-gradient-to-br from-[hsl(var(--primary)/0.15)] to-[hsl(var(--primary)/0.08)] border border-[hsl(var(--primary)/0.25)]">
      <PhoneCall className="h-5 w-5 text-primary" />
    </div>
    <DialogTitle className="text-2xl font-bold text-foreground">Modal Title</DialogTitle>
  </div>
  <DialogDescription className="text-base text-muted-foreground">
    Supporting description text
  </DialogDescription>
</DialogHeader>
```

**Features:**
- Icon badge with subtle primary gradient
- Consistent 5x5 icon size
- Proper spacing with `gap-3` and `pb-2`
- Title uses `text-foreground` for theme awareness
- Description uses `text-muted-foreground`

## Form Fields with Icons

### Input Field Pattern
```tsx
<div className="space-y-2.5">
  <Label htmlFor="fieldName" className="input-label">
    Field Label
  </Label>
  <div className="relative">
    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
    <input
      id="fieldName"
      type="email"
      placeholder="placeholder@example.com"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      style={{ paddingLeft: '2.5rem' }}
      className="input-field"
    />
  </div>
  <p className="text-xs text-muted-foreground leading-relaxed">
    Helper text goes here
  </p>
</div>
```

**Critical Details:**
- Use native `<input>` with `.input-field` class (not shadcn Input component)
- Icon positioned at `left-3` with `pointer-events-none`
- **Must use inline style** `paddingLeft: '2.5rem'` to prevent icon overlap
- Helper text uses `text-xs text-muted-foreground leading-relaxed`
- Label uses `.input-label` class from design system

### Why Inline Padding?
The `.input-field` class has default `padding-left: 1rem`. When you have an icon:
- Icon sits at `left-3` (0.75rem)
- Icon width is ~1rem
- Icon ends at ~1.75rem
- Need `2.5rem` padding so text starts after icon
- Use inline style to override class padding: `style={{ paddingLeft: '2.5rem' }}`

## Validation States

### Error Messages
```tsx
{value && !isValid && (
  <div className="flex items-center gap-1.5 text-destructive">
    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
    <p className="text-xs font-medium">
      Error message here
    </p>
  </div>
)}
```

**Features:**
- Flex layout with `gap-1.5`
- Icon uses `flex-shrink-0` to prevent squashing
- Text uses `font-medium` for emphasis
- Both use `text-destructive` for color

## Alert/Info Boxes

### Info Box (No Icon)
```tsx
<div className="rounded-lg border border-[hsl(var(--primary)/0.25)] bg-gradient-to-br from-[hsl(var(--primary)/0.06)] to-[hsl(var(--primary)/0.03)] p-4">
  <p className="text-sm text-muted-foreground leading-relaxed">
    Information text here. <span className="font-semibold text-foreground">Emphasized text</span> uses foreground color.
  </p>
</div>
```

### Error Alert
```tsx
<Alert variant="destructive" className="border-[hsl(var(--destructive)/0.3)] bg-gradient-to-br from-[hsl(var(--destructive)/0.08)] to-[hsl(var(--destructive)/0.04)]">
  <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
  <AlertDescription className="text-sm font-medium text-destructive">
    Error message here
  </AlertDescription>
</Alert>
```

**Gradient Philosophy:**
- Use very subtle gradients: from slightly lighter to slightly darker
- Info boxes: `from-[hsl(var(--primary)/0.06)] to-[hsl(var(--primary)/0.03)]`
- Error boxes: `from-[hsl(var(--destructive)/0.08)] to-[hsl(var(--destructive)/0.04)]`
- Success boxes: `from-[hsl(var(--success)/0.08)] to-[hsl(var(--success)/0.04)]`

## Modal Footer

### Standard Footer Pattern
```tsx
<DialogFooter className="gap-3 pt-3 border-t border-[hsl(var(--border)/0.4)]">
  <Button
    variant="outline"
    onClick={handleCancel}
    disabled={isLoading}
    className="rounded-lg px-5 py-2.5 text-sm font-semibold border border-[hsl(var(--border)/0.6)] bg-[hsl(var(--surface-muted))] text-foreground hover:bg-[hsl(var(--surface-raised))] hover:border-[hsl(var(--border))] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
  >
    Cancel
  </Button>
  <Button
    onClick={handleSubmit}
    disabled={!isValid}
    className="btn-primary px-5 py-2.5"
  >
    {isLoading ? (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </>
    ) : (
      <>
        <Icon className="mr-2 h-4 w-4" />
        Submit
      </>
    )}
  </Button>
</DialogFooter>
```

**Features:**
- Subtle border separator: `border-t border-[hsl(var(--border)/0.4)]`
- Gap between buttons: `gap-3`
- Top padding: `pt-3`
- Cancel button uses surface colors with hover states
- Primary button uses `.btn-primary` class
- Loading states with spinner icon

## Complete Example

```tsx
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Mail, PhoneCall } from "lucide-react";

export default function ExampleModal({ open, onOpenChange }) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = emailRegex.test(email);
  const canSubmit = isEmailValid && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Your submit logic here
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/95 backdrop-blur-md" />
        <DialogContent className="sm:max-w-[540px] bg-gradient-to-br from-[hsl(var(--surface-raised))] to-[hsl(var(--surface-muted))] border border-[hsl(var(--border)/0.6)] shadow-[var(--shadow-strong)]" showCloseButton={true}>
          <DialogHeader className="space-y-3 pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-gradient-to-br from-[hsl(var(--primary)/0.15)] to-[hsl(var(--primary)/0.08)] border border-[hsl(var(--primary)/0.25)]">
                <PhoneCall className="h-5 w-5 text-primary" />
              </div>
              <DialogTitle className="text-2xl font-bold text-foreground">
                Example Modal
              </DialogTitle>
            </div>
            <DialogDescription className="text-base text-muted-foreground">
              This is an example modal following the design system
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-3">
            {/* Info Box */}
            <div className="rounded-lg border border-[hsl(var(--primary)/0.25)] bg-gradient-to-br from-[hsl(var(--primary)/0.06)] to-[hsl(var(--primary)/0.03)] p-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Important information about this action. <span className="font-semibold text-foreground">Key details</span> are emphasized.
              </p>
            </div>

            {/* Form Field */}
            <div className="space-y-2.5">
              <Label htmlFor="email" className="input-label">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: '2.5rem' }}
                  className="input-field"
                />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                We&apos;ll never share your email with anyone else.
              </p>
              {email && !isEmailValid && (
                <div className="flex items-center gap-1.5 text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <p className="text-xs font-medium">
                    Please enter a valid email address
                  </p>
                </div>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <Alert variant="destructive" className="border-[hsl(var(--destructive)/0.3)] bg-gradient-to-br from-[hsl(var(--destructive)/0.08)] to-[hsl(var(--destructive)/0.04)]">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                <AlertDescription className="text-sm font-medium text-destructive">
                  {error}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="gap-3 pt-3 border-t border-[hsl(var(--border)/0.4)]">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-lg px-5 py-2.5 text-sm font-semibold border border-[hsl(var(--border)/0.6)] bg-[hsl(var(--surface-muted))] text-foreground hover:bg-[hsl(var(--surface-raised))] hover:border-[hsl(var(--border))] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="btn-primary px-5 py-2.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Submit
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
```

## Design Principles

### 1. **Theme Awareness**
- Always use HSL CSS variables: `hsl(var(--color-name))`
- Never hardcode colors - they won't adapt to dark mode
- Use semantic tokens: `--foreground`, `--muted-foreground`, `--primary`, etc.

### 2. **Subtle Gradients**
- Modal background: `from-[hsl(var(--surface-raised))] to-[hsl(var(--surface-muted))]`
- Alert boxes: Very low opacity gradients (3%-8%)
- Icon badges: Slightly higher opacity (8%-15%)
- Always diagonal: `bg-gradient-to-br` (bottom-right)

### 3. **Consistent Spacing**
- Section spacing: `space-y-5`
- Form field spacing: `space-y-2.5`
- Header padding bottom: `pb-2`
- Footer padding top: `pt-3`
- Button gaps: `gap-3`

### 4. **Icon Best Practices**
- Input icons: `h-4 w-4` positioned at `left-3`
- Header icons: `h-5 w-5` in badge
- Validation icons: `h-3.5 w-3.5` with `flex-shrink-0`
- Always use `pointer-events-none` on decorative icons
- Always use `text-muted-foreground` color unless semantic (error, success)

### 5. **Input Fields with Icons**
- **ALWAYS use inline style** for left padding: `style={{ paddingLeft: '2.5rem' }}`
- Use `.input-field` class from design system
- Use `.input-label` class for labels
- This prevents icon/text overlap

### 6. **Button Hierarchy**
- Primary action: `.btn-primary` class
- Cancel/secondary: Custom styling with surface colors
- Destructive: `.btn-destructive` class (when needed)
- Always show loading states with spinner

### 7. **Accessibility**
- Use semantic HTML elements (`<label>`, `<input>`)
- Associate labels with inputs via `htmlFor` and `id`
- Disabled states use `opacity-50` and `cursor-not-allowed`
- Focus states handled by `.input-field` class

## Common Mistakes to Avoid

❌ **DON'T:**
- Use shadcn `Input` component with icons (causes overlap)
- Use Tailwind padding classes with icon inputs (`pl-10` doesn't work)
- Hardcode colors instead of using CSS variables
- Forget `pointer-events-none` on decorative icons
- Use high opacity on alert gradients (too overwhelming)
- Skip the border separator in footer

✅ **DO:**
- Use native `<input>` with `.input-field` class
- Use inline style for icon padding: `style={{ paddingLeft: '2.5rem' }}`
- Use HSL CSS variables for all colors
- Add `pointer-events-none` to all decorative icons
- Keep alert gradients subtle (3%-8% opacity)
- Include border separator in footer for visual hierarchy

## Color Reference

### Primary (Info/Accent)
```css
border: border-[hsl(var(--primary)/0.25)]
background: bg-gradient-to-br from-[hsl(var(--primary)/0.06)] to-[hsl(var(--primary)/0.03)]
```

### Destructive (Error)
```css
border: border-[hsl(var(--destructive)/0.3)]
background: bg-gradient-to-br from-[hsl(var(--destructive)/0.08)] to-[hsl(var(--destructive)/0.04)]
```

### Success
```css
border: border-[hsl(var(--success)/0.3)]
background: bg-gradient-to-br from-[hsl(var(--success)/0.08)] to-[hsl(var(--success)/0.04)]
```

## Testing Checklist

When creating a modal, verify:
- [ ] Looks good in both light and dark mode
- [ ] Icons don't overlap with input text
- [ ] Gradients are subtle, not overwhelming
- [ ] Buttons have proper hover/disabled states
- [ ] Loading states show spinner
- [ ] Validation messages appear correctly
- [ ] Form fields have proper labels
- [ ] Modal backdrop has blur effect
- [ ] Spacing is consistent with design system
- [ ] All colors use CSS variables

