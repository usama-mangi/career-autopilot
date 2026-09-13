import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import { PageShell, PageHeader, Button, Card, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";
import type { InterviewPerformanceAnalytics, InterviewNote } from "types";

export const meta = () => [
  { title: "Career Autopilot | Interview Analytics" },
  { name: "description", content: "Analyze your interview performance and track improvement over time" },
];

export default function InterviewAnalytics() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [analytics, setAnalytics] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isPending && !isAuthenticated) { navigate("/login"); return; }
    if (isAuthenticated) loadAnalytics();
  }, [isAuthenticated, isPending, navigate]);

  async function loadAnalytics() {
    setLoading(true);
    try {
      const data = await api.interviewProcess.getAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error("Failed to load analytics:", err);
      reportError(err, { title: "Load failed", toastError, setError, retry: loadAnalytics });
    } finally {
      setLoading(false);
    }
  }

  function getRatingColor(rating: number) {
    if (rating >= 4) return "bg-green-500";
    if (rating >= 3) return "bg-blue-500";
    if (rating >= 2) return "bg-yellow-500";
    return "bg-red-500";
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Interview Analytics" subtitle="Loading..." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
        <div className="mt-8">
          <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      </PageShell>
    );
  }

  if (!analytics) {
    return (
      <PageShell>
        <PageHeader title="Interview Analytics" subtitle={error ? "Couldn't load analytics" : "No data available"} />
        {error ? (
          <ErrorBanner error={error} onRetry={loadAnalytics} />
        ) : (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500">Not enough interview data to generate analytics.</p>
          </div>
        )}
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Interview Analytics"
        subtitle="Conversion funnel: Applications → Screens → Interviews → Offers → Acceptance rate"
      />

      {error && <ErrorBanner error={error} onRetry={loadAnalytics} />}

      {/* Funnel */}
      <Card className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
        <div className="flex items-end gap-1.5 h-16">
          {[
            { label: "Applications", value: analytics.totalApplications, color: "bg-gray-500" },
            { label: "Screens", value: analytics.screensCount, color: "bg-blue-500" },
            { label: "Interviews", value: analytics.interviewsCount, color: "bg-purple-500" },
            { label: "Offers", value: analytics.offersCount, color: "bg-green-500" },
          ].map((step, i) => {
            const maxVal = Math.max(...[analytics.totalApplications, analytics.screensCount, analytics.interviewsCount, analytics.offersCount], 1);
            const height = Math.max((step.value / maxVal) * 100, 8);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-full rounded-t ${step.color}`} style={{ height: `${height}%` }}></div>
                <span className="text-sm font-medium text-gray-700">{step.value}</span>
                <span className="text-xs text-gray-500">{step.label}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0"><svg className="size-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
            <div>
              <p className="text-xl font-bold text-gray-900">{analytics.totalApplications}</p>
              <p className="text-xs text-gray-500">Total Applications</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0"><svg className="size-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg></div>
            <div>
              <p className="text-xl font-bold text-gray-900">{analytics.screensCount}</p>
              <p className="text-xs text-gray-500">Phone Screens</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-purple-50 flex items-center justify-center shrink-0"><svg className="size-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg></div>
            <div>
              <p className="text-xl font-bold text-gray-900">{analytics.interviewsCount}</p>
              <p className="text-xs text-gray-500">Interviews</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0"><svg className="size-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
            <div>
              <p className="text-xl font-bold text-gray-900">{analytics.offersCount}</p>
              <p className="text-xs text-gray-500">Offers</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Conversion Rates */}
      <Card className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Rates</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg text-center">
            <p className="text-3xl font-bold text-blue-600">{((analytics.screensCount / Math.max(analytics.totalApplications, 1)) * 100).toFixed(1)}%</p>
            <p className="text-sm text-gray-500 mt-1">Screen Rate</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg text-center">
            <p className="text-3xl font-bold text-primary-600">{((analytics.interviewsCount / Math.max(analytics.screensCount, 1)) * 100).toFixed(1)}%</p>
            <p className="text-sm text-gray-500 mt-1">Interview Rate</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg text-center">
            <p className="text-3xl font-bold text-green-600">{((analytics.offersCount / Math.max(analytics.interviewsCount, 1)) * 100).toFixed(1)}%</p>
            <p className="text-sm text-gray-500 mt-1">Offer Rate</p>
          </div>
        </div>
      </Card>

      {/* Overall Score */}
      <Card className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Interview Score</h3>
        <div className="flex items-center gap-4">
          <div className={cn("w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white", getRatingColor(analytics.selfRatingAverage || 0))}>
            {analytics.selfRatingAverage?.toFixed(1) || "—"}
          </div>
          <div className="flex-1">
            <p className="text-gray-700 leading-relaxed">Average self-rating across interviews: <strong>{analytics.selfRatingAverage?.toFixed(1) || "—"}/5</strong></p>
            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-500", getRatingColor(analytics.selfRatingAverage || 0))} style={{ width: `${((analytics.selfRatingAverage || 0) / 5) * 100}%` }}></div>
            </div>
          </div>
        </div>
      </Card>

      {/* Performance by Type */}
      {analytics.byType && analytics.byType.length > 0 && (
        <Card className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance by Interview Type</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Count</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg Rating</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Conversions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {analytics.byType.map((row: { type: string; count: number; avgRating: number; conversions: number }) => (
                  <tr key={row.type} className="hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
                        row.type === "phone" ? "bg-blue-100 text-blue-700" :
                        row.type === "video" ? "bg-purple-100 text-purple-700" :
                        row.type === "onsite" ? "bg-green-100 text-green-700" :
                        row.type === "technical" ? "bg-orange-100 text-orange-700" :
                        row.type === "behavioral" ? "bg-pink-100 text-pink-700" :
                        row.type === "case_study" ? "bg-teal-100 text-teal-700" :
                        row.type === "panel" ? "bg-primary-50 text-primary-600" :
                        row.type === "final" ? "bg-red-100 text-red-700" : "bg-[#F5EDE4] text-[#57534E]")}>
                        {row.type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-700">{row.count}</td>
                    <td className="py-2 px-3 text-right">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", getRatingColor(row.avgRating))}>
                        {row.avgRating.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-700">{row.conversions}/{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Recent Notes */}
      {analytics.recentNotes?.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Interview Notes</h3>
          <div className="space-y-3">
            {analytics.recentNotes.map((note: any) => (
              <div key={note.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white",
                    note.selfRating >= 4 ? "bg-green-500" : note.selfRating >= 3 ? "bg-blue-500" : "bg-yellow-500")}>
                    {note.selfRating}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{note.companyName} — {note.roleTitle}</p>
                    <p className="text-xs text-gray-500">
                      Round {note.roundNumber} · {note.interviewType.replace("_", " ")} · {new Date(note.interviewDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {note.strengths?.slice(0, 2).map((s: string, i: number) => (
                    <span key={i} className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </PageShell>
  );
}
