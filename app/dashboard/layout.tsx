"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const testMeter = useAction(api.testMeter.testLeadDiscoveryMeter);

  const navItems = [
    { label: "Overview", href: "/dashboard" },
    { label: "Agency", href: "/dashboard/agency" },
    { label: "Marketing", href: "/dashboard/marketing" },
    { label: "Calls", href: "/dashboard/calls" },
    { label: "Meetings", href: "/dashboard/meetings" },
    { label: "Emails", href: "/dashboard/emails" },
    { label: "Subscription", href: "/dashboard/subscription" },
    { label: "Settings", href: "/dashboard/settings" },
  ];

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="px-2 py-1 text-sm font-semibold">Modern Hack</div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const isActive =
                    item.href === "/dashboard"
                      ? pathname === item.href
                      : pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={item.href}>
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={async () => {
                  try {
                    const res = await testMeter({});
                    alert(res.message);
                  } catch (err) {
                    console.error("Test meter failed", err);
                    alert("Test metering failed. Check console for details.");
                  }
                }}
              >
                Test Autumn Meter
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={async () => {
                  await authClient.signOut();
                }}
              >
                Sign out
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <div className="flex items-center gap-2 border-b px-2 py-2">
          <SidebarTrigger />
          <div className="text-sm font-medium">Dashboard</div>
        </div>
        <div className="p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}


