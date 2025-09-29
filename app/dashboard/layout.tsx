"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
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
import { LogOut } from "lucide-react";
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
import { Button } from "@/components/ui/button";
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
  const isOnboarding = pathname === "/dashboard/onboarding";

  // For onboarding, render without sidebar
  if (isOnboarding) {
    return (
      <div className="min-h-screen bg-page-gradient-radial overflow-hidden">
        <OnboardingHeader />
        {children}
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar className="sidebar-surface">
        <SidebarHeader>
          <div className="flex items-center justify-between px-3 py-2">
            <div className="text-lg font-bold tracking-tight text-[hsl(var(--accent-foreground))]">
              Atlas Outbound
            </div>
            <div className="hidden md:flex items-center gap-2 group-data-[collapsible=icon]:hidden">
              <ThemeToggle />
              <SidebarTrigger />
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <NavigationMenu />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="sidebar-nav-button h-12 px-3 text-[0.95rem] justify-between"
                onClick={async () => {
                  await authClient.signOut();
                }}
                aria-label="Sign out"
              >
                <span>Sign out</span>
                <LogOut className="size-4" aria-hidden="true" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
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
    <SidebarMenu className="gap-2.5 p-2">
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
                isActive && "sidebar-nav-button"
              )}
            >
              <Link 
                href={item.href} 
                className="flex w-full items-center gap-3"
                onClick={handleNavClick}
              >
                <Icon className="size-4" />
                <span className="truncate">{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}


function CollapsedFloatingControls() {
  const { state, isMobile } = useSidebar();
  if (isMobile || state !== "collapsed") return null;
  return (
    <div className="fixed left-2 top-2 z-40">
      <div className="bg-sidebar-gradient-radial border border-[hsl(var(--sidebar-border))] rounded-md shadow-sm p-1 backdrop-blur-sm">
        <TooltipProvider>
          <div className="flex flex-col items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger className="size-9 rounded-md" aria-label="Toggle sidebar" />
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Toggle sidebar</p>
              </TooltipContent>
            </Tooltip>
            <ThemeToggle className="size-9" />
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
        <SidebarTrigger className="size-9 rounded-md hover:bg-accent/20 transition-colors" aria-label="Toggle sidebar" />
        <span className="text-lg font-bold tracking-tight text-foreground">
          Atlas Outbound
        </span>
      </div>
      <ThemeToggle />
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
      <ThemeToggle />
    </header>
  );
}


