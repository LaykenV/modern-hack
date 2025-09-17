"use client";

import { Authenticated, Unauthenticated } from "convex/react";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export default function Home() {
  return (
    <>
      <Unauthenticated>
        <AuthForms />
      </Unauthenticated>
      <Authenticated>
        <RedirectToDashboard />
      </Authenticated>
    </>
  );
}

function AuthForms() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });
      // In most cases the call above will redirect.
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err && "message" in err
          ? String((err as { message?: unknown }).message)
          : null;
      setError(message ?? "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 flex flex-col items-center">
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      <h1 className="text-3xl font-bold mb-4">Landing Page</h1>
      <p className="text-sm mb-4">Sign in with Google to continue</p>
      <button
        type="button"
        disabled={loading}
        onClick={onGoogleSignIn}
        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm px-4 py-2 rounded-md w-full disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.26-1.67 3.7-5.5 3.7-3.31 0-6-2.74-6-6.1S8.69 5.6 12 5.6c1.89 0 3.17.8 3.9 1.49l2.66-2.57C17.17 2.8 14.8 1.8 12 1.8 6.7 1.8 2.5 6.05 2.5 11.4S6.7 21 12 21c6.94 0 9.5-4.86 9.5-7.4 0-.5-.05-.86-.12-1.22H12z"/>
        </svg>
        {loading ? "Please wait..." : "Continue with Google"}
      </button>
    </div>
  );
}


function RedirectToDashboard() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return null;
}

// Removed unused Content/ResourceCard components
