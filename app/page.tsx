"use client";

import { Authenticated, Unauthenticated } from "convex/react";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  return (
    <>
      <Unauthenticated>
        <LandingPage />
      </Unauthenticated>
      <Authenticated>
        <RedirectToDashboard />
      </Authenticated>
    </>
  );
}

function LandingPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard/onboarding",
      });
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
    <div className="min-h-screen bg-page-gradient-radial">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-header-gradient-radial backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] flex items-center justify-center">
              <span className="text-lg font-bold text-primary-foreground">A</span>
            </div>
            <span className="text-xl font-bold text-foreground">Atlas Outbound</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-4 sm:px-6 lg:px-8 pt-12 pb-16 sm:pt-20 sm:pb-24">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 text-sm font-semibold text-primary mb-6 sm:mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            AI-Powered Outbound for Agencies
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground tracking-tight mb-6 sm:mb-8">
            Stop Prospecting.
            <br />
            <span className="bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent-foreground))] bg-clip-text text-transparent">
              Start Closing.
            </span>
          </h1>
          
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-8 sm:mb-12 leading-relaxed">
            The AI outbound platform for digital agencies. Find qualified local clients, identify their pain points, and book discovery calls—all automated.
          </p>

          {error && (
            <p className="text-destructive text-sm mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 max-w-md mx-auto">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={onGoogleSignIn}
            className="btn-primary text-base sm:text-lg px-8 py-4 font-semibold shadow-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden className="flex-shrink-0">
              <path fill="currentColor" d="M12 10.2v3.9h5.5c-.24 1.26-1.67 3.7-5.5 3.7-3.31 0-6-2.74-6-6.1S8.69 5.6 12 5.6c1.89 0 3.17.8 3.9 1.49l2.66-2.57C17.17 2.8 14.8 1.8 12 1.8 6.7 1.8 2.5 6.05 2.5 11.4S6.7 21 12 21c6.94 0 9.5-4.86 9.5-7.4 0-.5-.05-.86-.12-1.22H12z"/>
            </svg>
            {loading ? "Signing in..." : "Get Started with Google"}
          </button>

          <p className="text-xs sm:text-sm text-muted-foreground mt-4">
            Free to start • No credit card required
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
              From Discovery to Booked Call in Minutes
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Automate your entire outbound process with AI that actually understands your agency
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Feature 1 */}
            <div className="card-warm-static p-6 sm:p-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent-foreground))] flex items-center justify-center mb-4 shadow-lg">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Intelligent Lead Sourcing</h3>
              <p className="text-muted-foreground leading-relaxed">
                Define your ideal client profile and let AI find, filter, and rank qualified local businesses based on your specific criteria.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="card-warm-static p-6 sm:p-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent-foreground))] flex items-center justify-center mb-4 shadow-lg">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Instant Client Audits</h3>
              <p className="text-muted-foreground leading-relaxed">
                Automated mini-audits highlight specific pain points you can solve, with all facts cited and ready for your pitch.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="card-warm-static p-6 sm:p-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent-foreground))] flex items-center justify-center mb-4 shadow-lg">
                <span className="text-2xl">📞</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">AI Sales Calls</h3>
              <p className="text-muted-foreground leading-relaxed">
                Tailored outbound calls that reference specific gaps and your proven case studies to book discovery calls automatically.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="card-warm-static p-6 sm:p-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent-foreground))] flex items-center justify-center mb-4 shadow-lg">
                <span className="text-2xl">✅</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Proof-Based Outreach</h3>
              <p className="text-muted-foreground leading-relaxed">
                Extract case studies from your website and use them as cited proof points in every conversation.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="card-warm-static p-6 sm:p-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent-foreground))] flex items-center justify-center mb-4 shadow-lg">
                <span className="text-2xl">📧</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Professional Follow-ups</h3>
              <p className="text-muted-foreground leading-relaxed">
                Automated recap emails with cited case studies and calendar invites sent immediately after each call.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="card-warm-static p-6 sm:p-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent-foreground))] flex items-center justify-center mb-4 shadow-lg">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Real-Time Dashboard</h3>
              <p className="text-muted-foreground leading-relaxed">
                Track all outreach activities live with a complete timeline and credit usage meter for scale.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
              Your 5-Minute Demo Path
            </h2>
            <p className="text-lg text-muted-foreground">
              See how fast you can go from setup to booked call
            </p>
          </div>

          <div className="space-y-6">
            {/* Step 1 */}
            <div className="card-warm p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center">
                <span className="text-xl font-bold text-primary">1</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-foreground mb-2">Define Your Agency</h3>
                <p className="text-muted-foreground">
                  Paste your website URL. Atlas extracts your case studies and service offerings automatically. Approve your best proof points.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="card-warm p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center">
                <span className="text-xl font-bold text-primary">2</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-foreground mb-2">Find Qualified Clients</h3>
                <p className="text-muted-foreground">
                  Set your target vertical and geography. AI finds, filters, and ranks local businesses with clear qualification scores and pain point badges.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="card-warm p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center">
                <span className="text-xl font-bold text-primary">3</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-foreground mb-2">Let AI Make the Call</h3>
                <p className="text-muted-foreground">
                  Click to call. AI references specific gaps, cites your case studies, and books the discovery call. Follow-up email sent automatically.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Tech Stack */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-6">
            Powered By
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-muted-foreground/70">
            <span className="text-sm font-medium">Convex</span>
            <span className="text-sm font-medium">OpenAI</span>
            <span className="text-sm font-medium">Google Places</span>
            <span className="text-sm font-medium">Firecrawl</span>
            <span className="text-sm font-medium">Vapi</span>
            <span className="text-sm font-medium">Resend</span>
            <span className="text-sm font-medium">Autumn</span>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        <div className="max-w-4xl mx-auto">
          <div className="card-warm-accent p-8 sm:p-12 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Ready to Scale Your Agency?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join agencies using AI to automate their outbound and focus on what they do best—delivering results.
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={onGoogleSignIn}
              className="btn-primary text-base sm:text-lg px-8 py-4 font-semibold shadow-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden className="flex-shrink-0">
                <path fill="currentColor" d="M12 10.2v3.9h5.5c-.24 1.26-1.67 3.7-5.5 3.7-3.31 0-6-2.74-6-6.1S8.69 5.6 12 5.6c1.89 0 3.17.8 3.9 1.49l2.66-2.57C17.17 2.8 14.8 1.8 12 1.8 6.7 1.8 2.5 6.05 2.5 11.4S6.7 21 12 21c6.94 0 9.5-4.86 9.5-7.4 0-.5-.05-.86-.12-1.22H12z"/>
              </svg>
              {loading ? "Signing in..." : "Get Started Free"}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
          <p>&copy; 2025 Atlas Outbound. Built for digital agencies.</p>
        </div>
      </footer>
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
