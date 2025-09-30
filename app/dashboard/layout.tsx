"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogOut, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  Megaphone,
  Phone,
  Calendar,
  Mail,
  CreditCard,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agency", href: "/dashboard/agency", icon: Building2 },
  { label: "Marketing", href: "/dashboard/marketing", icon: Megaphone },
  { label: "Calls", href: "/dashboard/calls", icon: Phone },
  { label: "Meetings", href: "/dashboard/meetings", icon: Calendar },
  { label: "Emails", href: "/dashboard/emails", icon: Mail },
  { label: "Subscription", href: "/dashboard/subscription", icon: CreditCard },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isOnboarding = pathname === "/dashboard/onboarding";

  // Always call hooks unconditionally - only query on onboarding page
  const agencyProfile = useQuery(api.sellerBrain.getForCurrentUser);

  // Redirect to dashboard if onboarding is complete
  React.useEffect(() => {
    if (
      isOnboarding &&
      agencyProfile &&
      agencyProfile.tone &&
      agencyProfile.targetVertical &&
      agencyProfile.availability
    ) {
      router.replace("/dashboard");
    }
  }, [isOnboarding, agencyProfile, router]);

  // For onboarding, render without sidebar
  if (isOnboarding) {
    // Show loading state until we know whether to stay or redirect
    const isLoading = agencyProfile === undefined;
    const shouldRedirect =
      agencyProfile &&
      agencyProfile.tone &&
      agencyProfile.targetVertical &&
      agencyProfile.availability;

    if (isLoading || shouldRedirect) {
      return (
        <div className="min-h-screen bg-page-gradient-radial overflow-hidden flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-page-gradient-radial overflow-hidden">
        <OnboardingHeader />
        {children}
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="sidebar-surface">
        <SidebarHeader>
          <SidebarHeaderContent />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <NavigationMenu />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SignOutButton />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <CollapsedFloatingControls />
      <SidebarInset className="bg-page-gradient-radial overflow-hidden">
        <MobileHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}

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
    <SidebarMenu className="gap-2.5 p-2 group-data-[collapsible=icon]:gap-3">
      {navItems.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip={item.label}
              size="lg"
              className={cn(
                "h-11 px-3 text-[0.95rem] justify-start border border-transparent hover:border-[hsl(var(--ring)/0.40)] hover:shadow-[0_0_0_1px_hsl(var(--ring)/0.20)_inset]",
                "group-data-[collapsible=icon]:h-11 group-data-[collapsible=icon]:w-11 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:mx-auto",
                isActive && "sidebar-nav-button"
              )}
            >
              <Link 
                href={item.href} 
                className="flex w-full items-center gap-3 group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:justify-center"
                onClick={handleNavClick}
              >
                <Icon className="size-4 group-data-[collapsible=icon]:size-5" />
                <span className="truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function SignOutButton() {
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await authClient.signOut();
    } catch (error) {
      setIsSigningOut(false);
      console.error("Failed to sign out:", error);
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          className={cn(
            "sidebar-nav-button h-12 px-3 text-[0.95rem] justify-between, cursor-pointer",
            "group-data-[collapsible=icon]:h-11 group-data-[collapsible=icon]:w-11 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:mx-auto"
          )}
          onClick={handleSignOut}
          disabled={isSigningOut}
          tooltip="Sign out"
          aria-label="Sign out"
        >
          {isSigningOut ? (
            <Loader2 className="size-4 group-data-[collapsible=icon]:size-5 animate-spin" aria-hidden="true" />
          ) : (
            <LogOut className="size-4 group-data-[collapsible=icon]:size-5" aria-hidden="true" />
          )}
          <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function SidebarHeaderContent() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <div className="flex items-center justify-between px-3 py-2">
      {/* Show icon when collapsed, full text when expanded */}
      {isCollapsed ? (
        <div className="flex items-center justify-center w-full">
          <Image
            src="/atlas-icon.svg"
            alt="Atlas"
            width={32}
            height={32}
            className="transition-all duration-200"
          />
        </div>
      ) : (
        <>
          <div className="text-lg font-bold tracking-tight text-[hsl(var(--accent-foreground))]">
            Atlas Outbound
          </div>
          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle className="size-9 cursor-pointer hover:bg-accent/20 transition-colors rounded-md" />
            <SidebarTrigger className="size-9 cursor-pointer hover:bg-accent/20 transition-colors rounded-md" />
          </div>
        </>
      )}
    </div>
  );
}

function CollapsedFloatingControls() {
  const { state, isMobile } = useSidebar();
  if (isMobile || state !== "collapsed") return null;
  return (
    <div className="fixed left-[4.5rem] top-2 z-40">
      <div className="bg-sidebar-gradient-radial border border-[hsl(var(--sidebar-border))] rounded-md shadow-sm p-1 backdrop-blur-sm">
        <TooltipProvider>
          <div className="flex flex-col items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger className="size-9 rounded-md cursor-pointer hover:bg-accent/20 transition-colors" aria-label="Toggle sidebar" />
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Expand sidebar</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <ThemeToggle className="size-9 cursor-pointer hover:bg-accent/20 transition-colors rounded-md" aria-label="Toggle theme" />
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Toggle theme</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}

function MobileHeader() {
  const { isMobile } = useSidebar();
  if (!isMobile) return null;
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between p-4 bg-header-gradient-radial border-b border-[hsl(var(--border)/0.6)] backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="size-9 rounded-md cursor-pointer hover:bg-accent/20 transition-colors" aria-label="Toggle sidebar" />
        <span className="text-lg font-bold tracking-tight text-foreground">
          Atlas Outbound
        </span>
      </div>
      <ThemeToggle className="cursor-pointer hover:bg-accent/20 transition-colors rounded-md" />
    </header>
  );
}

function OnboardingHeader() {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between p-4 bg-header-gradient-radial border-b border-[hsl(var(--border)/0.6)] backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold tracking-tight text-foreground">
          Atlas Outbound
        </span>
      </div>
      <ThemeToggle className="cursor-pointer hover:bg-accent/20 transition-colors rounded-md" />
    </header>
  );
}


