## Atlas UX Upgrade Plan

### Overview
This document provides a systematic checklist for upgrading the UX of each page in the Atlas application. Use this alongside `design_plan.md` to ensure consistent, delightful user experiences across all dashboard pages.

### Goals
- Eliminate loading jank with proper loading states
- Maximize use of shadcn components for consistency and accessibility
- Optimize mobile UX with horizontal layouts and efficient information density
- Group related information logically to reduce cognitive load
- Provide clear feedback for all user actions
- Ensure accessibility throughout the application

---

## Universal UX Checklist

Apply this checklist to every page in the application:

### ✅ Loading States

**Loading Patterns:**
- [ ] **Initial page load**: Use Skeleton components from shadcn/ui
- [ ] **Data fetching**: Show skeleton loaders that match content structure
- [ ] **Button actions**: Show spinner inside button with disabled state
- [ ] **Infinite scroll/pagination**: Show loading indicator at bottom
- [ ] **Optimistic updates**: Show immediate feedback, revert on error

**Implementation:**
```tsx
import { Skeleton } from "@/components/ui/skeleton";

// Page loading skeleton
function PageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="card-warm-static p-6 md:p-8">
        <Skeleton className="h-10 w-64 mb-4" />
        <Skeleton className="h-6 w-96" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  );
}

// Button loading state
<Button disabled={isLoading} className="btn-primary">
  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  Submit
</Button>
```

**Empty States:**
- [ ] Every list/collection has a designed empty state
- [ ] Empty states include clear CTA to populate data
- [ ] Use friendly, encouraging copy

```tsx
import { FileQuestion } from "lucide-react";

function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <FileQuestion className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6">{description}</p>
      {action}
    </div>
  );
}
```

**Error States:**
- [ ] Network errors show retry button
- [ ] Form errors are inline and specific
- [ ] Use Alert component for page-level errors

```tsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>
    Failed to load data. <button onClick={retry} className="underline">Try again</button>
  </AlertDescription>
</Alert>
```

---

### ✅ Shadcn Component Usage

Replace custom implementations with shadcn components wherever possible:

**Core Components:**
- [ ] **Button** - Replace all custom buttons with `<Button variant="..." />`
- [ ] **Dialog** - Use for modals, confirmations, and detail views
- [ ] **Sheet** - Use for mobile sidebars and slide-out panels
- [ ] **Dropdown Menu** - Use for action menus and settings
- [ ] **Popover** - Use for inline help, filters, and small forms
- [ ] **Tooltip** - Add to all icon buttons and truncated text
- [ ] **Badge** - Use for status indicators and tags
- [ ] **Separator** - Use instead of `<hr>` or border divs
- [ ] **Skeleton** - Use for all loading states
- [ ] **Alert** - Use for inline notifications and errors
- [ ] **Card** - Consider shadcn Card component for simple cards (use custom `.card-warm` for advanced needs)

**Form Components:**
- [ ] **Input** - All text inputs
- [ ] **Textarea** - All multi-line inputs
- [ ] **Select** - Replace native selects
- [ ] **Checkbox** - All checkboxes
- [ ] **Radio Group** - All radio buttons
- [ ] **Switch** - Toggle settings
- [ ] **Label** - All form labels
- [ ] **Form** - Use with react-hook-form for validation

**Data Display:**
- [ ] **Table** - Use for tabular data with built-in responsive patterns
- [ ] **Accordion** - Use for collapsible sections
- [ ] **Tabs** - Use for section switching
- [ ] **Avatar** - Use for user/entity images
- [ ] **Progress** - Use for progress indicators

**Feedback:**
- [ ] **Toast** - Use for success/error notifications (via sonner)
- [ ] **Command** - Use for search/command palette (⌘K)

**Component Upgrade Map:**
| Current Pattern | Replace With |
|----------------|--------------|
| Custom modal divs | `<Dialog>` |
| Inline dropdowns | `<DropdownMenu>` |
| Custom tooltips | `<Tooltip>` |
| Status spans | `<Badge variant="...">` |
| Native select | `<Select>` |
| Custom checkboxes | `<Checkbox>` |
| Alert divs | `<Alert variant="...">` |
| Loading spinners in center | `<Skeleton>` matching content |

**Installation Check:**
```bash
# Ensure all needed components are installed:
npx shadcn@latest add button dialog sheet dropdown-menu popover tooltip badge separator skeleton alert card input textarea select checkbox radio-group switch label form table accordion tabs avatar progress toast command
```

---

### ✅ Mobile UX Optimization

**Horizontal vs Vertical Layout:**
- [ ] **Stat cards**: Grid 2 columns on mobile (avoid long vertical scrolling)
- [ ] **Action buttons**: Horizontal scroll container instead of vertical stack
- [ ] **Navigation tabs**: Horizontal scrollable tabs on mobile
- [ ] **Forms**: Keep single column (vertical) for forms - easier to fill
- [ ] **Data lists**: Consider horizontal cards on mobile for scanability

**Mobile-Specific Patterns:**

**1. Horizontal Scrolling Actions:**
```tsx
// Good for 4+ quick actions on mobile
<div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar md:grid md:grid-cols-4">
  {actions.map((action) => (
    <div key={action.id} className="flex-shrink-0 w-[140px] md:w-auto">
      <button className="action-link w-full">
        {action.content}
      </button>
    </div>
  ))}
</div>

<style jsx>{`
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`}</style>
```

**2. Horizontal Scrolling Stats:**
```tsx
// Alternative to grid for 5+ stats on mobile
<div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar lg:grid lg:grid-cols-5">
  {stats.map((stat) => (
    <div key={stat.id} className="flex-shrink-0 w-[160px] lg:w-auto">
      <StatCard {...stat} />
    </div>
  ))}
</div>
```

**3. Mobile Sheet for Details:**
```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";

// Use Sheet on mobile, Dialog on desktop
function ResponsiveDetailView() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger>View Details</SheetTrigger>
        <SheetContent side="bottom" className="h-[90vh]">
          <SheetHeader>
            <SheetTitle>Details</SheetTitle>
          </SheetHeader>
          {/* Content */}
        </SheetContent>
      </Sheet>
    );
  }
  
  return (
    <Dialog>
      {/* Desktop dialog */}
    </Dialog>
  );
}
```

**4. Touch-Friendly Targets:**
- [ ] All interactive elements minimum 44x44px hit area
- [ ] Adequate spacing between clickable items (min 8px gap)
- [ ] Bottom-sheet actions for mobile forms/confirmations

**5. Responsive Tables:**
```tsx
// Mobile: Stacked cards, Desktop: Table
<div className="md:hidden space-y-3">
  {data.map((item) => (
    <div key={item.id} className="card-warm p-4">
      <div className="flex justify-between items-start mb-2">
        <span className="font-semibold">{item.name}</span>
        <Badge>{item.status}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-muted-foreground">Field 1</p>
          <p className="font-medium">{item.field1}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Field 2</p>
          <p className="font-medium">{item.field2}</p>
        </div>
      </div>
    </div>
  ))}
</div>

<div className="hidden md:block">
  <Table>
    {/* Traditional table */}
  </Table>
</div>
```

**6. Fixed Mobile Actions:**
```tsx
// Sticky bottom action bar on mobile
<div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border md:hidden">
  <Button className="w-full btn-primary">Primary Action</Button>
</div>
```

---

### ✅ Information Architecture

**Card Grouping Principles:**
- [ ] Group related data on same card (don't split unnecessarily)
- [ ] Use Separator components to divide sections within cards
- [ ] Prioritize most important info at top of cards
- [ ] Use progressive disclosure (Accordion) for secondary details

**Effective Grouping Examples:**

**1. User Profile Card - Good:**
```tsx
<div className="card-warm-static p-6">
  <div className="flex items-start gap-4 mb-6">
    <Avatar className="h-16 w-16">
      <AvatarImage src={user.image} />
      <AvatarFallback>{user.initials}</AvatarFallback>
    </Avatar>
    <div>
      <h2 className="text-2xl font-bold">{user.name}</h2>
      <p className="text-muted-foreground">{user.email}</p>
      <Badge className="mt-2">{user.role}</Badge>
    </div>
  </div>
  
  <Separator className="my-6" />
  
  <div className="grid grid-cols-2 gap-4">
    <div>
      <p className="text-sm font-semibold text-muted-foreground">Joined</p>
      <p className="text-foreground mt-1">{user.joinDate}</p>
    </div>
    <div>
      <p className="text-sm font-semibold text-muted-foreground">Last Active</p>
      <p className="text-foreground mt-1">{user.lastActive}</p>
    </div>
  </div>
</div>
```

**2. Dashboard Stats - Group by Category:**
```tsx
// Instead of flat grid of 8 stats, group into logical sections:
<div className="space-y-6">
  <div className="card-warm-static p-6">
    <h3 className="text-lg font-semibold mb-4">Outreach Performance</h3>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <StatCard title="Emails Sent" value={120} variant="primary" />
      <StatCard title="Replies" value={45} variant="accent" />
      <StatCard title="Meetings" value={12} variant="accent" />
      <StatCard title="Reply Rate" value="37%" variant="accent" />
    </div>
  </div>
  
  <div className="card-warm-static p-6">
    <h3 className="text-lg font-semibold mb-4">Lead Generation</h3>
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      <StatCard title="Leads Found" value={89} variant="primary" />
      <StatCard title="Qualified" value={67} variant="accent" />
      <StatCard title="In Pipeline" value={34} variant="accent" />
    </div>
  </div>
</div>
```

**3. List Items - Keep Context Together:**
```tsx
// Good: All relevant info visible without clicking
<div className="card-warm p-4">
  <div className="flex items-start justify-between gap-4">
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-semibold text-foreground">{campaign.name}</h3>
        <Badge>{campaign.status}</Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-3">{campaign.description}</p>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">
          <Mail className="inline h-3 w-3 mr-1" />
          {campaign.emailsSent} sent
        </span>
        <span className="text-muted-foreground">
          <MessageSquare className="inline h-3 w-3 mr-1" />
          {campaign.replies} replies
        </span>
        <span className="text-muted-foreground">
          <Calendar className="inline h-3 w-3 mr-1" />
          {campaign.date}
        </span>
      </div>
    </div>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>Edit</DropdownMenuItem>
        <DropdownMenuItem>Duplicate</DropdownMenuItem>
        <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</div>
```

**4. Progressive Disclosure with Accordion:**
```tsx
<Accordion type="single" collapsible className="space-y-3">
  <AccordionItem value="advanced" className="card-warm border-0">
    <AccordionTrigger className="px-6 py-4 hover:no-underline">
      <span className="font-semibold">Advanced Settings</span>
    </AccordionTrigger>
    <AccordionContent className="px-6 pb-4">
      {/* Less frequently used settings */}
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

---

### ✅ Interaction Patterns

**Form UX:**
- [ ] Use react-hook-form with shadcn Form components
- [ ] Show inline validation errors
- [ ] Disable submit button while processing
- [ ] Show success toast after submission
- [ ] Clear/reset form after successful submission
- [ ] Auto-focus first input on mount

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

function MyForm() {
  const form = useForm({
    resolver: zodResolver(schema),
  });
  
  const onSubmit = async (data) => {
    try {
      await submitData(data);
      toast.success("Successfully saved!");
      form.reset();
    } catch (error) {
      toast.error("Failed to save. Please try again.");
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit
        </Button>
      </form>
    </Form>
  );
}
```

**Confirmation Dialogs:**
- [ ] Use AlertDialog for destructive actions
- [ ] Make primary action color match severity
- [ ] Focus cancel button by default for safety

```tsx
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Delete Campaign</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone. This will permanently delete the campaign
        and all associated data.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Toast Notifications:**
- [ ] Success: Green checkmark with clear message
- [ ] Error: Red with retry action if applicable
- [ ] Info: Blue with optional action
- [ ] Loading: Show for long operations (>2s)

```tsx
import { toast } from "sonner";

// Success
toast.success("Campaign created successfully!");

// Error with action
toast.error("Failed to send email", {
  action: {
    label: "Retry",
    onClick: () => retrySend(),
  },
});

// Loading
const toastId = toast.loading("Processing...");
// Later:
toast.success("Complete!", { id: toastId });
```

**Tooltips Everywhere:**
- [ ] All icon-only buttons have tooltips
- [ ] Truncated text has tooltip showing full text
- [ ] Complex UI elements have explanatory tooltips

```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon">
        <Settings className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Open settings</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

**Keyboard Shortcuts:**
- [ ] Command+K for search/command palette
- [ ] Escape to close dialogs/sheets
- [ ] Enter to submit forms
- [ ] Arrow keys for navigation in lists

---

### ✅ Accessibility

**Checklist:**
- [ ] All images have alt text
- [ ] All icon buttons have aria-label
- [ ] Form inputs have associated labels
- [ ] Focus styles are visible (default ring from design system)
- [ ] Color is not the only indicator of state
- [ ] Dialogs trap focus
- [ ] Skip navigation link for keyboard users

**Implementation:**
```tsx
// Icon button with aria-label
<Button variant="ghost" size="icon" aria-label="Delete item">
  <Trash className="h-4 w-4" />
</Button>

// Status with icon + text
<Badge className="bg-primary/20 text-primary">
  <CheckCircle className="mr-1 h-3 w-3" />
  Active
</Badge>

// Skip navigation
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg">
  Skip to main content
</a>
```

---

### ✅ Performance UX

**Optimistic Updates:**
- [ ] Update UI immediately for user actions
- [ ] Revert on error with toast notification
- [ ] Use Convex optimistic updates where applicable

```tsx
const addItem = useMutation(api.items.add);

async function handleAdd(item) {
  // Optimistically add to UI
  const optimisticItem = { ...item, id: 'temp-' + Date.now() };
  setItems(prev => [...prev, optimisticItem]);
  
  try {
    const realItem = await addItem(item);
    // Replace optimistic with real
    setItems(prev => prev.map(i => i.id === optimisticItem.id ? realItem : i));
    toast.success("Item added!");
  } catch (error) {
    // Revert on error
    setItems(prev => prev.filter(i => i.id !== optimisticItem.id));
    toast.error("Failed to add item");
  }
}
```

**Debouncing Search:**
- [ ] Debounce search inputs (300-500ms)
- [ ] Show loading indicator while searching
- [ ] Cancel previous requests

```tsx
import { useDebouncedCallback } from 'use-debounce';

const handleSearch = useDebouncedCallback(
  (value: string) => {
    setSearchQuery(value);
  },
  300
);

<Input
  placeholder="Search..."
  onChange={(e) => handleSearch(e.target.value)}
/>
```

**Pagination vs Infinite Scroll:**
- [ ] Tables: Use pagination with shadcn Table
- [ ] Feeds/Lists: Use infinite scroll with "Load more" button fallback
- [ ] Show total count when paginated

---

## Page-Specific Checklist Template

Use this template when upgrading each page:

### Page: [Page Name]

**Loading States:**
- [ ] Initial page load skeleton implemented
- [ ] All data fetches show loading state
- [ ] Button actions show loading spinner
- [ ] Empty states designed and implemented
- [ ] Error states with retry implemented

**Shadcn Components:**
- [ ] All buttons use Button component
- [ ] Modals use Dialog component
- [ ] Dropdowns use DropdownMenu component
- [ ] Forms use Form + Input/Select/etc components
- [ ] Status indicators use Badge component
- [ ] Tooltips added to icon buttons
- [ ] Tables use Table component (if applicable)
- [ ] List: [any other shadcn components used]

**Mobile UX:**
- [ ] Tested on mobile viewport (375px)
- [ ] Stat cards in 2-column grid on mobile
- [ ] Action buttons optimized for mobile (horizontal scroll or stacked)
- [ ] Navigation works smoothly on mobile
- [ ] Touch targets are 44x44px minimum
- [ ] Modals use Sheet on mobile if appropriate
- [ ] Tables convert to cards on mobile

**Information Architecture:**
- [ ] Related info grouped on same cards
- [ ] Card titles are clear and descriptive
- [ ] Most important info visible without scrolling
- [ ] Progressive disclosure used for secondary info
- [ ] Visual hierarchy is clear (titles > content > metadata)

**Interaction Patterns:**
- [ ] Forms validated with inline errors
- [ ] Success/error toasts implemented
- [ ] Destructive actions have confirmation dialogs
- [ ] All interactive elements have hover states
- [ ] Keyboard navigation works properly

**Accessibility:**
- [ ] All images have alt text
- [ ] All icon buttons have aria-labels
- [ ] Focus styles are visible
- [ ] Color not sole indicator of state
- [ ] Tested with keyboard navigation

**Performance:**
- [ ] Optimistic updates where applicable
- [ ] Search debounced
- [ ] Large lists paginated or virtual scrolled
- [ ] No unnecessary re-renders

---

## Priority Order for Upgrades

Tackle pages in this order for maximum impact:

1. **Dashboard Overview** ✅ (Already complete - use as reference)
2. **Marketing Campaigns** (High usage, complex data)
3. **Calls Page** (High usage, real-time data)
4. **Call Detail Page** (Complex, lots of data)
5. **Agency Profile** (Forms, complex state)
6. **Onboarding** (Multi-step, critical UX)
7. **Meetings** (Calendar, scheduling UX)
8. **Settings** (Forms)
9. **Subscription** (Simple, lower priority)

---

## Testing Checklist

After upgrading each page:

**Functionality:**
- [ ] All features work as before
- [ ] No console errors
- [ ] Forms submit correctly
- [ ] Data loads properly
- [ ] Actions trigger correct mutations

**Responsive:**
- [ ] Test on mobile (375px)
- [ ] Test on tablet (768px)
- [ ] Test on desktop (1280px+)
- [ ] Test on ultra-wide (1920px+)

**Performance:**
- [ ] Page loads in <2s on 3G
- [ ] No layout shift during load
- [ ] Smooth scrolling
- [ ] No janky animations

**Accessibility:**
- [ ] Tab through all interactive elements
- [ ] Test with screen reader (VoiceOver/NVDA)
- [ ] Check contrast ratios (WCAG AA minimum)
- [ ] Test keyboard shortcuts

**Cross-browser:**
- [ ] Chrome/Edge
- [ ] Safari
- [ ] Firefox

---

## Common Patterns Library

### Search with Filters

```tsx
<div className="card-warm-static p-6">
  <div className="flex flex-col sm:flex-row gap-3">
    <div className="flex-1">
      <Input
        placeholder="Search..."
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        className="w-full"
      />
    </div>
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Filters
          {activeFilters > 0 && (
            <Badge className="ml-2">{activeFilters}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <h4 className="font-semibold">Filter by</h4>
          {/* Filter controls */}
        </div>
      </PopoverContent>
    </Popover>
  </div>
</div>
```

### Bulk Actions

```tsx
const [selectedItems, setSelectedItems] = useState<string[]>([]);

<div className="card-warm-static p-6">
  {selectedItems.length > 0 && (
    <div className="flex items-center justify-between mb-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
      <span className="text-sm font-semibold">
        {selectedItems.length} selected
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={handleBulkAction}>
          <Edit className="mr-2 h-3 w-3" />
          Edit
        </Button>
        <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
          <Trash className="mr-2 h-3 w-3" />
          Delete
        </Button>
      </div>
    </div>
  )}
  
  {/* List with checkboxes */}
  <div className="space-y-2">
    {items.map((item) => (
      <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-muted/50">
        <Checkbox
          checked={selectedItems.includes(item.id)}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedItems(prev => [...prev, item.id]);
            } else {
              setSelectedItems(prev => prev.filter(id => id !== item.id));
            }
          }}
        />
        <div className="flex-1">{/* Item content */}</div>
      </div>
    ))}
  </div>
</div>
```

### Inline Editing

```tsx
const [isEditing, setIsEditing] = useState(false);
const [value, setValue] = useState(initialValue);

{isEditing ? (
  <div className="flex items-center gap-2">
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') handleCancel();
      }}
      autoFocus
    />
    <Button size="icon" variant="ghost" onClick={handleSave}>
      <Check className="h-4 w-4" />
    </Button>
    <Button size="icon" variant="ghost" onClick={handleCancel}>
      <X className="h-4 w-4" />
    </Button>
  </div>
) : (
  <div className="flex items-center gap-2 group">
    <span>{value}</span>
    <Button
      size="icon"
      variant="ghost"
      className="opacity-0 group-hover:opacity-100"
      onClick={() => setIsEditing(true)}
    >
      <Pencil className="h-3 w-3" />
    </Button>
  </div>
)}
```

### Multi-Step Process

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

<Tabs value={currentStep} onValueChange={setCurrentStep}>
  <TabsList className="grid grid-cols-3 w-full">
    <TabsTrigger value="step1" disabled={currentStep < 1}>
      Step 1
    </TabsTrigger>
    <TabsTrigger value="step2" disabled={currentStep < 2}>
      Step 2
    </TabsTrigger>
    <TabsTrigger value="step3" disabled={currentStep < 3}>
      Step 3
    </TabsTrigger>
  </TabsList>
  
  <TabsContent value="step1">
    {/* Step 1 content */}
    <Button onClick={() => setCurrentStep('step2')}>Next</Button>
  </TabsContent>
  
  <TabsContent value="step2">
    {/* Step 2 content */}
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => setCurrentStep('step1')}>Back</Button>
      <Button onClick={() => setCurrentStep('step3')}>Next</Button>
    </div>
  </TabsContent>
  
  <TabsContent value="step3">
    {/* Step 3 content */}
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => setCurrentStep('step2')}>Back</Button>
      <Button className="btn-primary" onClick={handleComplete}>Complete</Button>
    </div>
  </TabsContent>
</Tabs>
```

---

## Implementation Tips

1. **Start with skeleton**: Build loading state first, then fill with real data
2. **Mobile-first**: Design for mobile, enhance for desktop
3. **Use Convex patterns**: Leverage Convex's reactivity for real-time updates
4. **Test incrementally**: Don't build entire page then test - test each section
5. **Reuse components**: Extract common patterns into shared components
6. **Document new patterns**: If you create a new pattern, add it to this doc

---

## Resources

- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Radix UI Primitives](https://www.radix-ui.com/)
- [React Hook Form](https://react-hook-form.com/)
- [Sonner Toast](https://sonner.emilkowal.ski/)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

## Notes

This is a living document. As we discover new patterns or edge cases during implementation, add them here for future reference. Every upgrade should make the app more delightful to use while maintaining our clean, vibrant design aesthetic.
