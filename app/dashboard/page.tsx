"use client";

import { Authenticated, Unauthenticated, useQuery, useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import Image from "next/image";
import { CreditMeter } from "@/components/CreditMeter";
import Link from "next/link";

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
  const sellerBrain = useQuery(api.sellerBrain.getForCurrentUser);
  const router = useRouter();
  const testMeter = useAction(api.testMeter.testLeadDiscoveryMeter);
  const testLeadGen = useAction(api.leadGen.test.searchPlacesText);
  const onboardingStatus = useQuery(api.onboarding.queries.getOnboardingStatus, { onboardingFlowId: sellerBrain?.onboardingFlowId });

  useEffect(() => {
    if (user && (!sellerBrain || (onboardingStatus !== "completed" && onboardingStatus !== null))) {
      router.replace("/dashboard/onboarding");
    }
  }, [user, sellerBrain, router, onboardingStatus]);
  return (
    <div className="max-w-2xl mx-auto w-full">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <div className="mb-4">
        <button
          className="border border-slate-300 dark:border-slate-700 text-sm px-4 py-2 rounded-md"
          onClick={async () => {
            await authClient.signOut();
          }}
        >
          Sign out
        </button>
        <button
          className="border border-slate-300 dark:border-slate-700 text-sm px-4 py-2 rounded-md ml-2"
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
        </button>
        <button
          className="border border-slate-300 dark:border-slate-700 text-sm px-4 py-2 rounded-md ml-2"
          onClick={async () => {
            const res = await testLeadGen({ textQuery: "roofers in San Francisco" });
            alert(JSON.stringify(res));
          }}
        >
          Test Lead Gen
        </button>
        <Link href="/dashboard/subscription">Subscription</Link>
      </div>
      <p className="mb-2">You are signed in.</p>
      <p className="mb-2">Email: {user?.email}</p>
      <p className="mb-2">Name: {user?.name}</p>
      <p className="mb-2">ID: {user?._id}</p>
      <p className="mb-2">Created At: {user?.createdAt}</p>
      <p className="mb-2">Updated At: {user?.updatedAt}</p>
      {user?.image && <Image
                      src={user.image}
                      alt="User Image"
                      width={96}
                      height={96}
                      className="mb-2 rounded-full"
                      priority
                    />}
      <CreditMeter />
      {sellerBrain && (
        <div className="mt-8 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-3">Seller Brain</h2>
          <div className="grid grid-cols-1 gap-2">
            <p>
              <span className="font-medium">Company:</span> {sellerBrain.companyName}
            </p>
            <p>
              <span className="font-medium">Source URL:</span> {sellerBrain.sourceUrl}
            </p>
            {typeof sellerBrain.summary !== "undefined" && (
              <p>
                <span className="font-medium">Summary:</span> {sellerBrain.summary}
              </p>
            )}
            <p>
              <span className="font-medium">Status:</span> {onboardingStatus ?? "Not started"}
            </p>
            {typeof sellerBrain.tone !== "undefined" && (
              <p>
                <span className="font-medium">Tone:</span> {sellerBrain.tone}
              </p>
            )}
            {typeof sellerBrain.timeZone !== "undefined" && (
              <p>
                <span className="font-medium">Time Zone:</span> {sellerBrain.timeZone}
              </p>
            )}
            {Array.isArray(sellerBrain.availability) && sellerBrain.availability.length > 0 && (
              <p>
                <span className="font-medium">Availability:</span> {sellerBrain.availability.join(", ")}
              </p>
            )}
            {Array.isArray(sellerBrain.targetVertical) && sellerBrain.targetVertical.length > 0 && (
              <p>
                <span className="font-medium">Target Vertical:</span> {sellerBrain.targetVertical.join(", ")}
              </p>
            )}
            {sellerBrain.targetGeography && (
              <p>
                <span className="font-medium">Target Geography:</span> {sellerBrain.targetGeography}
              </p>
            )}
            {sellerBrain.coreOffer && (
              <p>
                <span className="font-medium">Core Offer:</span> {sellerBrain.coreOffer}
              </p>
            )}
            {Array.isArray(sellerBrain.leadQualificationCriteria) && sellerBrain.leadQualificationCriteria.length > 0 && (
              <p>
                <span className="font-medium">Lead Qualification Criteria:</span> {sellerBrain.leadQualificationCriteria.join(", ")}
              </p>
            )}
            {Array.isArray(sellerBrain.guardrails) && sellerBrain.guardrails.length > 0 && (
              <div>
                <p className="font-medium">Guardrails:</p>
                <ul className="list-disc ml-6 mt-1">
                  {sellerBrain.guardrails.map((g, idx) => (
                    <li key={`guardrail-${idx}`}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
            {Array.isArray(sellerBrain.approvedClaims) && sellerBrain.approvedClaims.length > 0 && (
              <div>
                <p className="font-medium">Approved Claims:</p>
                <ul className="list-disc ml-6 mt-1">
                  {sellerBrain.approvedClaims.map((c) => (
                    <li key={c.id}>
                      <span>{c.text}</span>
                      {c.source_url && (
                        <>
                          {" "}
                          <a
                            href={c.source_url}
                            className="text-blue-600 dark:text-blue-400 underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            source
                          </a>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


