import { Link, useNavigate, useParams } from "react-router";
import { useEffect, useState } from "react";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { PageShell, Button, Card } from "~/components/ui";
import { ErrorBanner } from "~/components/ui";
import First90PlanView from "~/components/First90PlanView";
import type { First90DaysTracker } from "types";

export const meta = () => [
  { title: "Career Autopilot | First 90 Days Plan" },
];

/**
 * Single 90-day plan detail: where toolkit deep links land. Shows one
 * tracker's phases, feedback loops, and early wins, with application context.
 */
export default function PlanDetail() {
  const { id } = useParams();
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();

  const [tracker, setTracker] = useState<First90DaysTracker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isPending && !isAuthenticated) {
      navigate("/login");
      return;
    }
    if (!isAuthenticated || !id) return;
    let cancelled = false;
    api.postOnboarding.getTracker(id)
      .then((data) => {
        if (!cancelled) setTracker(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Plan not found");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isPending, id, navigate]);

  if (loading) {
    return (
      <PageShell>
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-64 bg-gray-100 rounded-lg" />
          <div className="h-40 bg-gray-100 rounded-xl" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </PageShell>
    );
  }

  if (error || !tracker) {
    return (
      <PageShell>
        <ErrorBanner error={error || "Plan not found"} />
        <div className="text-center py-8">
          <Link to="/onboarding/first-90-days">
            <Button variant="secondary">Back to All Plans</Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  const startDate = tracker.startDate ? new Date(tracker.startDate) : null;

  return (
    <PageShell maxWidth="2xl">
      {/* Context trail */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6 flex-wrap">
        <Link to="/onboarding/first-90-days" className="hover:text-primary-600 transition-colors">First 90 Days</Link>
        <span>/</span>
        <span className="text-gray-600 truncate">{tracker.companyName} — {tracker.roleTitle}</span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            First 90 Days · {tracker.companyName}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {tracker.roleTitle}
            {startDate && ` · Starting ${startDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`}
          </p>
        </div>
        <Link to="/onboarding/first-90-days">
          <Button variant="outline" size="sm">All Plans</Button>
        </Link>
      </div>

      {tracker.applicationId && (
        <Link
          to={`/applications/${tracker.applicationId}`}
          className="inline-flex items-center gap-1.5 mb-6 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 transition"
        >
          ↩ From application
        </Link>
      )}

      <First90PlanView tracker={tracker} />
    </PageShell>
  );
}
