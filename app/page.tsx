"use client";

import { useMutation, useQuery, Authenticated, Unauthenticated } from "convex/react";
import { api } from "../convex/_generated/api";
import Link from "next/link";
import { useState } from "react";
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
          <Content />
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
    </div>
  );
}

function Content() {
  const { viewer, numbers } =
    useQuery(api.myFunctions.listNumbers, {
      count: 10,
    }) ?? {};
  const addNumber = useMutation(api.myFunctions.addNumber);

  if (viewer === undefined || numbers === undefined) {
    return (
      <div className="mx-auto">
        <p>loading... (consider a loading skeleton)</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-lg mx-auto">
      <p>Welcome {viewer ?? "Anonymous"}!</p>
      <p>
        Click the button below and open this page in another window - this data
        is persisted in the Convex cloud database!
      </p>
      <p>
        <button
          className="bg-foreground text-background text-sm px-4 py-2 rounded-md"
          onClick={() => {
            void addNumber({ value: Math.floor(Math.random() * 10) });
          }}
        >
          Add a random number
        </button>
      </p>
      <p>
        Numbers:{" "}
        {numbers?.length === 0
          ? "Click the button!"
          : numbers?.join(", ") ?? "..."}
      </p>
      <p>
        Edit{" "}
        <code className="text-sm font-bold font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded-md">
          convex/myFunctions.ts
        </code>{" "}
        to change your backend
      </p>
      <p>
        Edit{" "}
        <code className="text-sm font-bold font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded-md">
          app/page.tsx
        </code>{" "}
        to change your frontend
      </p>
      <p>
        See the{" "}
        <Link href="/server" className="underline hover:no-underline">
          /server route
        </Link>{" "}
        for an example of loading data in a server component
      </p>
      <div className="flex flex-col">
        <p className="text-lg font-bold">Useful resources:</p>
        <div className="flex gap-2">
          <div className="flex flex-col gap-2 w-1/2">
            <ResourceCard
              title="Convex docs"
              description="Read comprehensive documentation for all Convex features."
              href="https://docs.convex.dev/home"
            />
            <ResourceCard
              title="Stack articles"
              description="Learn about best practices, use cases, and more from a growing
            collection of articles, videos, and walkthroughs."
              href="https://www.typescriptlang.org/docs/handbook/2/basic-types.html"
            />
          </div>
          <div className="flex flex-col gap-2 w-1/2">
            <ResourceCard
              title="Templates"
              description="Browse our collection of templates to get started quickly."
              href="https://www.convex.dev/templates"
            />
            <ResourceCard
              title="Discord"
              description="Join our developer community to ask questions, trade tips & tricks,
            and show off your projects."
              href="https://www.convex.dev/community"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ResourceCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <div className="flex flex-col gap-2 bg-slate-200 dark:bg-slate-800 p-4 rounded-md h-28 overflow-auto">
      <a href={href} className="text-sm underline hover:no-underline">
        {title}
      </a>
      <p className="text-xs">{description}</p>
    </div>
  );
}
