"use client";

import { Authenticated, Unauthenticated, useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";

export default function OnboardingPage() {
  return (
    <main className="p-8 flex flex-col gap-6">
      <Unauthenticated>
        <RedirectToHome />
      </Unauthenticated>
      <Authenticated>
        <Content />
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

function Content() {
  const router = useRouter();
  const existing = useQuery(api.sellerBrain.getForCurrentUser);
  const seed = useAction(api.sellerBrain.seedFromWebsite);
  const finalize = useMutation(api.sellerBrain.finalizeOnboardingPublic);

  const [companyName, setCompanyName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  // Step 2 state
  type Claim = { id: string; text: string; source_url: string };
  const [claims, setClaims] = useState<Array<Claim>>([]);
  const [selectedClaimIds, setSelectedClaimIds] = useState<Set<string>>(new Set());

  const [guardrails, setGuardrails] = useState<string[]>([]);
  const [guardrailInput, setGuardrailInput] = useState<string>("");
  const [tone, setTone] = useState<string>("consultative");
  const [icpIndustry, setIcpIndustry] = useState<string[]>([]);
  const [icpCompanySize, setIcpCompanySize] = useState<string[]>([]);
  const [icpBuyerRole, setIcpBuyerRole] = useState<string[]>([]);
  const [timeZone, setTimeZone] = useState<string>("");
  const [availabilityDay, setAvailabilityDay] = useState<string>("Tue");
  const [availabilityStart, setAvailabilityStart] = useState<string>("10:00");
  const [availabilityEnd, setAvailabilityEnd] = useState<string>("12:00");
  const [availabilitySlots, setAvailabilitySlots] = useState<string[]>([]);

  const INDUSTRIES: string[] = [
    "Software",
    "Fintech",
    "Healthcare",
    "E-commerce",
    "Education",
    "Manufacturing",
    "Retail",
    "Travel",
    "Real Estate",
    "Telecommunications",
    "Media",
    "Energy",
    "Logistics",
    "Professional Services",
    "Government",
  ];
  const COMPANY_SIZES: string[] = ["1-10", "11-50", "51-200", "201-1000", "1000+"];
  const BUYER_ROLES: string[] = [
    "Head of Operations",
    "VP Operations",
    "COO",
    "Head of Sales",
    "VP Sales",
    "CRO",
    "Head of Marketing",
    "VP Marketing",
    "CMO",
    "CTO",
    "CIO",
    "Head of Customer Success",
    "VP Customer Success",
    "CEO",
    "Founder",
  ];
  const NA_TIMEZONES: string[] = [
    "America/Los_Angeles",
    "America/Denver",
    "America/Phoenix",
    "America/Chicago",
    "America/New_York",
    "America/Anchorage",
    "America/Honolulu",
    "America/Toronto",
    "America/Vancouver",
    "America/Mexico_City",
  ];
  const DAYS: string[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  useEffect(() => {
    if (existing?.crawlStatus === "seeded") {
      setStep(2);
      const seeded = existing.approvedClaims ?? [];
      setClaims(seeded);
      setSelectedClaimIds(new Set(seeded.map((c) => c.id)));
      if (!timeZone) setTimeZone("America/Los_Angeles");
    } else if (existing?.crawlStatus === "approved") {
      router.replace("/dashboard");
    }
  }, [existing, router, timeZone]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!companyName || !sourceUrl) {
        throw new Error("Please provide both company name and website URL.");
      }
      const normalizedUrl = sourceUrl.startsWith("http")
        ? sourceUrl
        : `https://${sourceUrl}`;
      await seed({ companyName, sourceUrl: normalizedUrl });
      router.replace("/dashboard");
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err && "message" in err
          ? String((err as { message?: unknown }).message)
          : null;
      setError(message ?? "Failed to seed seller brain.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto w-full">
      <h1 className="text-3xl font-bold mb-2">Onboarding</h1>
      {step === 1 && (
        <>
          <p className="text-sm text-slate-500 mb-6">
            Step 1: Enter your company and website. We&apos;ll seed a placeholder Seller Brain.
          </p>
          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
          {existing?.crawlStatus === "crawling" && (
            <p className="text-sm text-slate-500 mb-2">Crawling your site… please wait.</p>
          )}
          {existing?.crawlStatus === "error" && existing.crawlError && (
            <p className="text-sm text-red-600 mb-2">{existing.crawlError}</p>
          )}
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm">Company name</span>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-900"
                placeholder="Acme Corp"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm">Website URL</span>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-900"
                placeholder="https://example.com"
              />
            </label>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="border border-slate-300 dark:border-slate-700 text-sm px-4 py-2 rounded-md disabled:opacity-50"
              >
                {loading ? "Seeding…" : "Continue"}
              </button>
            </div>
          </form>
        </>
      )}

      {step === 2 && (
        <>
          <p className="text-sm text-slate-500 mb-6">Step 2: Approve claims and set preferences.</p>
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="font-medium mb-2">Approved claims</h2>
              {claims.length === 0 ? (
                <p className="text-sm text-slate-500">No draft claims available. You can add your own below.</p>
              ) : (
                <ul className="space-y-2">
                  {claims.map((c) => (
                    <li key={c.id} className="border border-slate-300 dark:border-slate-700 rounded-md p-3 flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selectedClaimIds.has(c.id)}
                        onChange={(e) => {
                          setSelectedClaimIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(c.id);
                            else next.delete(c.id);
                            return next;
                          });
                        }}
                      />
                      <div>
                        <p className="text-sm mb-1">{c.text}</p>
                        <p className="text-xs text-slate-500">Source: {c.source_url}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm">Guardrails</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={guardrailInput}
                  onChange={(e) => setGuardrailInput(e.target.value)}
                  className="flex-1 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-900"
                  placeholder="Type a guardrail and press Add"
                />
                <button
                  type="button"
                  className="border border-slate-300 dark:border-slate-700 text-sm px-3 py-2 rounded-md"
                  onClick={() => {
                    const val = guardrailInput.trim();
                    if (!val) return;
                    setGuardrails((prev) => (prev.includes(val) ? prev : [...prev, val]));
                    setGuardrailInput("");
                  }}
                >
                  Add
                </button>
              </div>
              {guardrails.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {guardrails.map((g) => (
                    <span key={g} className="inline-flex items-center gap-2 border border-slate-300 dark:border-slate-700 rounded-full px-2 py-1 text-xs">
                      {g}
                      <button
                        type="button"
                        className="text-slate-500 hover:text-slate-700"
                        onClick={() => setGuardrails((prev) => prev.filter((x) => x !== g))}
                        aria-label={`Remove ${g}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm">Tone</span>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-900"
              >
                <option value="consultative">Consultative</option>
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
              </select>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-sm">ICP Industry</span>
                <div className="border border-slate-300 dark:border-slate-700 rounded-md p-2 max-h-40 overflow-auto">
                  {INDUSTRIES.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm py-1">
                      <input
                        type="checkbox"
                        checked={icpIndustry.includes(opt)}
                        onChange={(e) => {
                          setIcpIndustry((prev) =>
                            e.target.checked ? [...prev, opt] : prev.filter((v) => v !== opt),
                          );
                        }}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm">Company Size</span>
                <div className="border border-slate-300 dark:border-slate-700 rounded-md p-2 max-h-40 overflow-auto">
                  {COMPANY_SIZES.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm py-1">
                      <input
                        type="checkbox"
                        checked={icpCompanySize.includes(opt)}
                        onChange={(e) => {
                          setIcpCompanySize((prev) =>
                            e.target.checked ? [...prev, opt] : prev.filter((v) => v !== opt),
                          );
                        }}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm">Buyer Role</span>
                <div className="border border-slate-300 dark:border-slate-700 rounded-md p-2 max-h-40 overflow-auto">
                  {BUYER_ROLES.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm py-1">
                      <input
                        type="checkbox"
                        checked={icpBuyerRole.includes(opt)}
                        onChange={(e) => {
                          setIcpBuyerRole((prev) =>
                            e.target.checked ? [...prev, opt] : prev.filter((v) => v !== opt),
                          );
                        }}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm">Time zone</span>
                <select
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  className="border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-900"
                >
                  {NA_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col gap-2">
                <span className="text-sm">Availability</span>
                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    value={availabilityDay}
                    onChange={(e) => setAvailabilityDay(e.target.value)}
                    className="border border-slate-300 dark:border-slate-700 rounded-md px-2 py-2 text-sm bg-white dark:bg-slate-900"
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={availabilityStart}
                    onChange={(e) => setAvailabilityStart(e.target.value)}
                    className="border border-slate-300 dark:border-slate-700 rounded-md px-2 py-2 text-sm bg-white dark:bg-slate-900"
                  />
                  <span className="text-sm">to</span>
                  <input
                    type="time"
                    value={availabilityEnd}
                    onChange={(e) => setAvailabilityEnd(e.target.value)}
                    className="border border-slate-300 dark:border-slate-700 rounded-md px-2 py-2 text-sm bg-white dark:bg-slate-900"
                  />
                  <button
                    type="button"
                    className="border border-slate-300 dark:border-slate-700 text-sm px-3 py-2 rounded-md"
                    onClick={() => {
                      if (!availabilityStart || !availabilityEnd) return;
                      const slot = `${availabilityDay} ${availabilityStart}-${availabilityEnd}`;
                      setAvailabilitySlots((prev) => (prev.includes(slot) ? prev : [...prev, slot]));
                    }}
                  >
                    Add slot
                  </button>
                </div>
                {availabilitySlots.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {availabilitySlots.map((s) => (
                      <span key={s} className="inline-flex items-center gap-2 border border-slate-300 dark:border-slate-700 rounded-full px-2 py-1 text-xs">
                        {s}
                        <button
                          type="button"
                          className="text-slate-500 hover:text-slate-700"
                          onClick={() => setAvailabilitySlots((prev) => prev.filter((x) => x !== s))}
                          aria-label={`Remove ${s}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  setError(null);
                  try {
                    const selected = claims.filter((c) => selectedClaimIds.has(c.id));
                    if (selected.length === 0) {
                      throw new Error("Please approve at least one claim.");
                    }
                    await finalize({
                      approvedClaims: selected,
                      guardrails,
                      tone,
                      icpIndustry,
                      icpCompanySize,
                      icpBuyerRole,
                      timeZone,
                      availability: availabilitySlots,
                    });
                    router.replace("/dashboard");
                  } catch (err: unknown) {
                    const message =
                      typeof err === "object" && err && "message" in err
                        ? String((err as { message?: unknown }).message)
                        : null;
                    setError(message ?? "Failed to finalize onboarding.");
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="border border-slate-300 dark:border-slate-700 text-sm px-4 py-2 rounded-md disabled:opacity-50"
              >
                {loading ? "Saving…" : "Finish"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


