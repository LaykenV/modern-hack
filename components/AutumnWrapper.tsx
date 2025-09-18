"use client";
import { AutumnProvider } from "autumn-js/react";
import { api } from "@/convex/_generated/api";
import { useConvex } from "convex/react";

export function AutumnWrapper({ children }: { children: React.ReactNode }) {
  const convex = useConvex();
  // Cast to the shape AutumnProvider expects without using any
  const convexApi = (api as unknown as { autumn: unknown }).autumn as unknown;
  return <AutumnProvider convex={convex} convexApi={convexApi}>{children}</AutumnProvider>;
}