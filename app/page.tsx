"use client";

import { Authenticated, Unauthenticated } from "convex/react";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        Convex + Next.js
      </header>
      <main className="p-8 flex flex-col gap-16">
        <h1 className="text-4xl font-bold text-center">Convex + Next.js</h1>
        <Unauthenticated>
          <AuthForms />
        </Unauthenticated>
        <Authenticated>
          <RedirectToDashboard />
        </Authenticated>
      </main>
    </>
  );
}

function AuthForms() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await authClient.signIn.social({
        provider: "google",
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "signup") {
        const { error } = await authClient.signUp.email({
          name: name || email,
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await authClient.signIn.email({
          email,
          password,
        });
        if (error) throw error;
      }
      router.replace("/dashboard");
    } catch (err: unknown) {
      const message = typeof err === "object" && err && "message" in err ? String((err as { message?: unknown }).message) : null;
      setError(message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto w-full">
      <div className="flex justify-center gap-2 mb-4">
        <button
          className={`px-3 py-1 rounded ${mode === "signin" ? "bg-foreground text-background" : "bg-slate-200 dark:bg-slate-800"}`}
          onClick={() => setMode("signin")}
        >
          Sign in
        </button>
        <button
          className={`px-3 py-1 rounded ${mode === "signup" ? "bg-foreground text-background" : "bg-slate-200 dark:bg-slate-800"}`}
          onClick={() => setMode("signup")}
        >
          Sign up
        </button>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {mode === "signup" && (
          <input
            className="px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-background"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <input
          type="email"
          className="px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-background"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          className="px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-background"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-foreground text-background text-sm px-4 py-2 rounded-md disabled:opacity-50"
        >
          {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>
      <div className="my-4 flex items-center gap-3">
        <div className="h-px bg-slate-300 dark:bg-slate-700 flex-1" />
        <span className="text-xs text-slate-500">or</span>
        <div className="h-px bg-slate-300 dark:bg-slate-700 flex-1" />
      </div>
      <button
        type="button"
        disabled={loading}
        onClick={onGoogleSignIn}
        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm px-4 py-2 rounded-md w-full disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.26-1.67 3.7-5.5 3.7-3.31 0-6-2.74-6-6.1S8.69 5.6 12 5.6c1.89 0 3.17.8 3.9 1.49l2.66-2.57C17.17 2.8 14.8 1.8 12 1.8 6.7 1.8 2.5 6.05 2.5 11.4S6.7 21 12 21c6.94 0 9.5-4.86 9.5-7.4 0-.5-.05-.86-.12-1.22H12z"/>
        </svg>
        Continue with Google
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
