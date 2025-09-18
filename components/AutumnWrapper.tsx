"use client";
import { AutumnProvider } from "autumn-js/react";
import { api } from "@/convex/_generated/api";
import { useConvex } from "convex/react";
import { authClient } from "@/lib/auth-client";

export function AutumnWrapper({ children }: { children: React.ReactNode }) {
  const convex = useConvex();
  const convexApi = (api as unknown as { autumn: unknown }).autumn as unknown;
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return null;
  return (
    <AutumnProvider key={`auth-${Boolean(session)}`} convex={convex} convexApi={convexApi}>
      {children}
    </AutumnProvider>
  );
}