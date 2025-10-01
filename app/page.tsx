"use client";

import { useConvexAuth } from "convex/react";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function Home() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  // Show nothing while checking auth to avoid flash
  if (isLoading || isAuthenticated) {
    return null;
  }

  return <LandingPage />;
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
    <div className="min-h-screen bg-page-gradient-radial relative overflow-hidden">
      {/* Hero background visuals */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="bg-grid-soft absolute inset-0 opacity-[0.28]" />
        <div className="orb orb-primary w-[45rem] h-[45rem] -top-32 -left-40" />
        <div className="orb orb-accent w-[36rem] h-[36rem] -bottom-24 -right-20" />
      </div>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-header-gradient-radial backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] flex items-center justify-center">
              <span className="text-lg font-bold text-primary-foreground">A</span>
            </div>
            <span className="text-xl font-bold text-foreground">Atlas Outbound</span>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onGoogleSignIn}
            className="btn-primary text-sm px-4 sm:px-6 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-16 sm:pb-24 relative">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left: Copy */}
            <div className="lg:col-span-5 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 badge-primary-soft mb-5">
                <span className="w-2 h-2 rounded-full bg-[hsl(var(--primary))]" />
                <span className="text-xs font-medium tracking-wide">Agency-ready outbound platform</span>
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-6xl xl:text-7xl font-bold text-foreground tracking-tight mb-5">
                Stop Prospecting.
                <br />
                <span className="bg-gradient-to-t from-[hsl(var(--primary))] to-[hsl(var(--accent-foreground))] bg-clip-text text-transparent">
                  Start Closing.
                </span>
              </h1>
              <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-2xl lg:max-w-none mx-auto lg:mx-0 mb-6 sm:mb-8 leading-relaxed">
                Find qualified local clients, identify their pain points, and book discovery calls—all automated and tailored to your agency.
              </p>

              {error && (
                <p className="text-destructive text-sm mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 max-w-md mx-auto lg:mx-0">
                  {error}
                </p>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 justify-center lg:justify-start">
                <button
                  type="button"
                  disabled={loading}
                  onClick={onGoogleSignIn}
                  className="btn-primary text-base sm:text-lg px-7 sm:px-8 py-3.5 sm:py-4 font-semibold shadow-lg"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden className="flex-shrink-0">
                    <path fill="currentColor" d="M12 10.2v3.9h5.5c-.24 1.26-1.67 3.7-5.5 3.7-3.31 0-6-2.74-6-6.1S8.69 5.6 12 5.6c1.89 0 3.17.8 3.9 1.49l2.66-2.57C17.17 2.8 14.8 1.8 12 1.8 6.7 1.8 2.5 6.05 2.5 11.4S6.7 21 12 21c6.94 0 9.5-4.86 9.5-7.4 0-.5-.05-.86-.12-1.22H12z"/>
                  </svg>
                  {loading ? "Signing in..." : "Get Started with Google"}
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4 mt-4">
                <span className="text-xs sm:text-sm text-muted-foreground">Free to start</span>
                <span className="text-muted-foreground/40">•</span>
                <span className="text-xs sm:text-sm text-muted-foreground">No credit card required</span>
                <span className="text-muted-foreground/40">•</span>
                <span className="text-xs sm:text-sm text-muted-foreground">Set up in minutes</span>
              </div>
            </div>

            {/* Right: Hero image */}
            <div className="lg:col-span-7">
              <div className="glass-panel p-2 sm:p-3 lg:p-4 relative overflow-hidden">
                <Image
                  src="/image.png"
                  alt="Atlas Outbound dashboard preview"
                  width={1920}
                  height={1080}
                  priority
                  sizes="(min-width: 1536px) 860px, (min-width: 1280px) 760px, (min-width: 1024px) 640px, 100vw"
                  className="w-full h-auto rounded-lg"
                />
                <div className="absolute -bottom-8 -right-8 w-40 h-40 orb orb-primary opacity-60" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24">
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
            <div className="card-warm-static card-gradient-soft p-6 sm:p-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent-foreground))] flex items-center justify-center mb-4 shadow-lg">
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden className="text-primary-foreground">
                  <path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8a8.01 8.01 0 0 1-8 8Zm1-13h-2v4l3.5 2.1l1-1.65L13 10.2Z"/>
                </svg>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Intelligent Lead Sourcing</h3>
              <p className="text-muted-foreground leading-relaxed">
                Define your ideal client profile and let AI find, filter, and rank qualified local businesses based on your specific criteria.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="card-warm-static card-gradient-soft p-6 sm:p-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent-foreground))] flex items-center justify-center mb-4 shadow-lg">
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden className="text-primary-foreground">
                  <path fill="currentColor" d="M3 3h2v18H3zm4 10h2v8H7zm4-6h2v14h-2zm4 4h2v10h-2zm4-8h2v18h-2z"/>
                </svg>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Instant Client Audits</h3>
              <p className="text-muted-foreground leading-relaxed">
                Automated mini-audits highlight specific pain points you can solve, with all facts cited and ready for your pitch.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="card-warm-static card-gradient-soft p-6 sm:p-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent-foreground))] flex items-center justify-center mb-4 shadow-lg">
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden className="text-primary-foreground">
                  <path fill="currentColor" d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24a11.36 11.36 0 0 0 3.56.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 7a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1a11.36 11.36 0 0 0 .57 3.56a1 1 0 0 1-.24 1.02Z"/>
                </svg>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">AI Sales Calls</h3>
              <p className="text-muted-foreground leading-relaxed">
                Tailored outbound calls that reference specific gaps and your proven case studies to book discovery calls automatically.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="card-warm-static card-gradient-soft p-6 sm:p-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent-foreground))] flex items-center justify-center mb-4 shadow-lg">
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden className="text-primary-foreground">
                  <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19l12-12l-1.41-1.41z"/>
                </svg>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Proof-Based Outreach</h3>
              <p className="text-muted-foreground leading-relaxed">
                Extract case studies from your website and use them as cited proof points in every conversation.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="card-warm-static card-gradient-soft p-6 sm:p-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent-foreground))] flex items-center justify-center mb-4 shadow-lg">
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden className="text-primary-foreground">
                  <path fill="currentColor" d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4l-8 5L4 8V6l8 5l8-5Z"/>
                </svg>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Professional Follow-ups</h3>
              <p className="text-muted-foreground leading-relaxed">
                Automated recap emails with cited case studies and calendar invites sent immediately after each call.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="card-warm-static card-gradient-soft p-6 sm:p-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent-foreground))] flex items-center justify-center mb-4 shadow-lg">
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden className="text-primary-foreground">
                  <path fill="currentColor" d="M13 2L3 14h7v8l11-14h-8z"/>
                </svg>
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
      <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24">
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
            <div className="card-warm card-gradient-soft p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start">
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
            <div className="card-warm card-gradient-soft p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start">
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
            <div className="card-warm card-gradient-soft p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start">
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
          <div className="flex flex-wrap items-center justify-center gap-x-4 sm:gap-x-6 lg:gap-x-8 gap-y-3 text-muted-foreground/70">
            {[
              "Convex",
              "OpenAI",
              "Google Places",
              "Firecrawl",
              "Vapi",
              "Resend",
              "Autumn",
            ].map((name) => (
              <span key={name} className="text-sm font-medium px-3 py-1 rounded-md badge-soft">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28">
        <div className="max-w-4xl mx-auto">
          <div className="card-warm-accent p-8 sm:p-12 text-center relative overflow-hidden">
            <div aria-hidden className="orb orb-primary w-[28rem] h-[28rem] -top-24 -left-16" />
            <div aria-hidden className="orb orb-accent w-[20rem] h-[20rem] -bottom-16 -right-12" />
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
