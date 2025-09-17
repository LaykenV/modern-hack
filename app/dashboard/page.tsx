"use client";

import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";

export default function DashboardPage() {
  return (
    <main className="p-8 flex flex-col gap-6">
      <Unauthenticated>
        <RedirectToHome />
      </Unauthenticated>
      <Authenticated>
        <DashboardContent />
      </Authenticated>
    </main>
  );
}

function RedirectToHome() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}

function DashboardContent() {
  const user = useQuery(api.auth.getCurrentUser);
  return (
    <div className="max-w-2xl mx-auto w-full">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <p className="mb-2">You are signed in.</p>
      <p className="mb-2">User: {user?.email}</p>
      <p className="mb-2">Name: {user?.name}</p>
      <p className="mb-2">ID: {user?._id}</p>
      <p className="mb-2">Created At: {user?.createdAt}</p>
      <p className="mb-2">Updated At: {user?.updatedAt}</p>
      <p className="mb-2">Verified: {user?.emailVerified}</p>
    </div>
  );
}


