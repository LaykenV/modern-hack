"use client";

import { Authenticated, Unauthenticated, useQuery, useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import Image from "next/image";
import { CreditMeter } from "@/components/CreditMeter";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";

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
  const startLeadGenWorkflow = useAction(api.marketing.startLeadGenWorkflow);
  const onboardingStatus = useQuery(api.onboarding.queries.getOnboardingStatus, { onboardingFlowId: sellerBrain?.onboardingFlowId });
  
  // State for lead generation
  const [currentJobId, setCurrentJobId] = useState<Id<"lead_gen_flow"> | null>(null);
  const [numLeads, setNumLeads] = useState(5);
  const [targetVertical, setTargetVertical] = useState("");
  const [targetGeography, setTargetGeography] = useState("");
  
  // Query for lead gen job status
  const leadGenJob = useQuery(
    api.marketing.getLeadGenJob, 
    currentJobId ? { jobId: currentJobId } : "skip"
  );
  
  // Query for lead gen jobs history  
  const leadGenJobs = useQuery(
    api.marketing.listLeadGenJobsByAgency,
    sellerBrain?.agencyProfileId ? { agencyId: sellerBrain.agencyProfileId } : "skip"
  );

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
      
      {/* Lead Generation Workflow Section */}
      <div className="mt-8 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-3">Lead Generation Workflow</h2>
        
        {/* Start Workflow Form */}
        <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900 rounded">
          <h3 className="text-lg font-medium mb-3">Start New Lead Generation</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Number of Leads (1-20)</label>
              <input
                type="number"
                min="1"
                max="20"
                value={numLeads}
                onChange={(e) => setNumLeads(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Target Vertical (optional)</label>
              <input
                type="text"
                value={targetVertical}
                onChange={(e) => setTargetVertical(e.target.value)}
                placeholder="e.g., roofers, dentists"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Target Geography (optional)</label>
              <input
                type="text"
                value={targetGeography}
                onChange={(e) => setTargetGeography(e.target.value)}
                placeholder="e.g., San Francisco, CA"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md"
              />
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                const result = await startLeadGenWorkflow({
                  numLeads,
                  targetVertical: targetVertical || undefined,
                  targetGeography: targetGeography || undefined,
                });
                setCurrentJobId(result.jobId);
                alert(`Lead generation started! Job ID: ${result.jobId}`);
              } catch (err) {
                console.error("Failed to start lead generation:", err);
                alert("Failed to start lead generation. Check console for details.");
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Start Lead Generation
          </button>
        </div>

        {/* Current Job Status */}
        {leadGenJob && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
            <h3 className="text-lg font-medium mb-3">Current Job Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p><strong>Job ID:</strong> {leadGenJob._id}</p>
                <p><strong>Status:</strong> {leadGenJob.status}</p>
                <p><strong>Workflow Status:</strong> {leadGenJob.workflowStatus || "N/A"}</p>
                <p><strong>Leads Requested:</strong> {leadGenJob.numLeadsRequested}</p>
                <p><strong>Leads Fetched:</strong> {leadGenJob.numLeadsFetched}</p>
              </div>
              <div>
                <p><strong>Target Vertical:</strong> {leadGenJob.campaign.targetVertical}</p>
                <p><strong>Target Geography:</strong> {leadGenJob.campaign.targetGeography}</p>
                {leadGenJob.lastEvent && (
                  <div className="mt-2">
                    <p><strong>Last Event:</strong></p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {leadGenJob.lastEvent.message} ({new Date(leadGenJob.lastEvent.timestamp).toLocaleString()})
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Phase Progress */}
            <div className="mt-4">
              <h4 className="font-medium mb-2">Phase Progress:</h4>
              <div className="space-y-2">
                {leadGenJob.phases.map((phase) => (
                  <div key={phase.name} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      phase.status === "complete" ? "bg-green-500" :
                      phase.status === "running" ? "bg-blue-500" :
                      phase.status === "error" ? "bg-red-500" :
                      "bg-gray-300"
                    }`} />
                    <span className="capitalize">{phase.name.replace("_", " ")}</span>
                    <span className="text-sm text-slate-500">({Math.round(phase.progress * 100)}%)</span>
                    {phase.status === "running" && <span className="text-blue-600">Running...</span>}
                    {phase.status === "error" && phase.errorMessage && (
                      <span className="text-red-600 text-sm">Error: {phase.errorMessage}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Places Snapshot */}
            {leadGenJob.placesSnapshot && leadGenJob.placesSnapshot.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Places Found ({leadGenJob.placesSnapshot.length}):</h4>
                <div className="max-h-60 overflow-y-auto">
                  <div className="grid grid-cols-1 gap-2">
                    {leadGenJob.placesSnapshot.map((place) => (
                      <div key={place.id} className="p-2 bg-white dark:bg-slate-800 rounded border">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{place.name}</p>
                            {place.address && <p className="text-sm text-slate-600">{place.address}</p>}
                            {place.phone && <p className="text-sm">📞 {place.phone}</p>}
                            {place.website && (
                              <p className="text-sm">
                                🌐 <a href={place.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                  {place.website}
                                </a>
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            {place.rating && (
                              <p className="text-sm">⭐ {place.rating}</p>
                            )}
                            {place.reviews && (
                              <p className="text-sm text-slate-500">({place.reviews} reviews)</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Job History */}
        {leadGenJobs && leadGenJobs.length > 0 && (
          <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded">
            <h3 className="text-lg font-medium mb-3">Recent Jobs</h3>
            <div className="space-y-2">
              {leadGenJobs.slice(0, 5).map((job) => (
                <div 
                  key={job._id} 
                  className={`p-3 rounded border cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 ${
                    currentJobId === job._id ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-slate-200 dark:border-slate-700"
                  }`}
                  onClick={() => setCurrentJobId(job._id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">
                        {job.campaign.targetVertical} in {job.campaign.targetGeography}
                      </p>
                      <p className="text-sm text-slate-600">
                        {job.numLeadsFetched}/{job.numLeadsRequested} leads • {job.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-500">
                        {new Date(job._creationTime).toLocaleDateString()}
                      </p>
                      {job.lastEvent && (
                        <p className="text-xs text-slate-400">
                          {job.lastEvent.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


