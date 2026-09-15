import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { PageShell, PageHeader, Card, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

interface AnalyticsData {
  total: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  avgDaysToOffer: number | null;
  conversionRates: {
    appliedToScreen: number;
    screenToInterview: number;
    interviewToOffer: number;
    appliedToOffer: number;
    overallSuccess: number;
  };
}

export const meta = () => [
  { title: "Career Autopilot | Applications Analytics" },
  { name: "description", content: "Conversion funnel: Applications → Screens → Interviews → Offers → Acceptance rate" },
];

export default function ApplicationsAnalytics() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { error: toastError } = useToastHelpers();

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, isPending, navigate]);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.applications.analytics({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setAnalytics(data as unknown as AnalyticsData);
    } catch (err) {
      console.error("Failed to load analytics:", err);
      reportError(err, { title: "Load failed", toastError, setError, retry: loadAnalytics });
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (isAuthenticated) loadAnalytics();
  }, [isAuthenticated, loadAnalytics]);

  const topSources = analytics?.bySource
    ? Object.entries(analytics.bySource).sort((a, b) => b[1] - a[1]).slice(0, 5)
    : [];

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Application Analytics" subtitle="Loading..." />
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
        <PageHeader title="Application Analytics" subtitle={error ? "Couldn't load analytics" : "No data available"} />
        {error ? (
          <ErrorBanner error={error} onRetry={loadAnalytics} />
        ) : (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500">Not enough application data to generate analytics.</p>
          </div>
        )}
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Application Analytics"
        subtitle="Conversion funnel: Applications → Screens → Interviews → Offers → Acceptance rate"
      />

      {error && <ErrorBanner error={error} onRetry={loadAnalytics} />}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <p className="text-sm text-gray-500">Total Applications</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{analytics.total}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Applied &rarr; Offer</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{analytics.conversionRates.appliedToOffer}%</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Overall Success</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{analytics.conversionRates.overallSuccess}%</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Avg Days to Offer</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{analytics.avgDaysToOffer ?? "\u2014"}</p>
        </Card>
      </div>

      {/* Funnel */}
      <Card className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
        <div className="flex items-end gap-1.5 h-16">
          {[
            { label: "Applications", value: analytics.total, color: "bg-gray-500" },
            { label: "Screens", value: analytics.byStatus.phone_screen || 0, color: "bg-blue-500" },
            { label: "Interviews", value: analytics.byStatus.interviewing || 0, color: "bg-warning" },
            { label: "Offers", value: analytics.byStatus.offer || 0, color: "bg-green-500" },
          ].map((step) => {
            const maxVal = Math.max(
              analytics.total,
              analytics.byStatus.phone_screen || 0,
              analytics.byStatus.interviewing || 0,
              analytics.byStatus.offer || 0,
              1
            );
            return (
              <div key={step.label} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(step.value / maxVal) * 100}%`, backgroundColor: step.color }} />
                </div>
                <span className="text-xs font-medium text-gray-900">{step.value}</span>
                <span className="text-xs text-gray-500">{step.label}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Conversion Rates */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Rates</h3>
          <div className="space-y-3">
            {[
              { label: "Applied \u2192 Phone Screen", value: analytics.conversionRates.appliedToScreen },
              { label: "Phone Screen \u2192 Interview", value: analytics.conversionRates.screenToInterview },
              { label: "Interview \u2192 Offer", value: analytics.conversionRates.interviewToOffer },
            ].map((rate) => (
              <div key={rate.label} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{rate.label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${rate.value}%` }} />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-12 text-right">{rate.value}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Sources */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Applications by Source</h3>
          <div className="space-y-3">
            {topSources.map(([source, count]) => (
              <div key={source} className="flex items-center justify-between">
                <span className="font-medium text-gray-700 text-sm capitalize">{source}</span>
                <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-lg">{count} app{count !== 1 ? "s" : ""}</span>
              </div>
            ))}
            {topSources.length === 0 && <p className="text-sm text-gray-400">No data yet</p>}
          </div>
        </Card>
      </div>

      {/* By Status Breakdown */}
      <Card className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Applications by Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(analytics.byStatus).map(([status, count]) => (
            <div key={status} className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <p className="text-xs text-gray-500 capitalize mt-1">{status.replace(/_/g, " ")}</p>
            </div>
          ))}
        </div>
      </Card>
    </PageShell>
  );
}
