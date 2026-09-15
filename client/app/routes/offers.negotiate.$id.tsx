import { Link, useNavigate, useParams } from "react-router";
import { useEffect, useState } from "react";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { PageShell, Button, Card } from "~/components/ui";
import { ErrorBanner } from "~/components/ui";
import NegotiationStrategyView from "~/components/NegotiationStrategyView";
import type { NegotiationCoach } from "types";

export const meta = () => [
  { title: "Career Autopilot | Negotiation Strategy" },
];

/**
 * Single coach-session detail: where toolkit and list deep links land.
 * Shows one negotiation strategy in full, with its application context.
 */
export default function CoachSessionDetail() {
  const { id } = useParams();
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();

  const [coach, setCoach] = useState<NegotiationCoach | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isPending && !isAuthenticated) {
      navigate("/login");
      return;
    }
    if (!isAuthenticated || !id) return;
    let cancelled = false;
    api.offerNegotiation.getCoach(id)
      .then((data) => {
        if (!cancelled) setCoach(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Strategy not found");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isPending, id]);

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

  if (error || !coach) {
    return (
      <PageShell>
        <ErrorBanner error={error || "Strategy not found"} />
        <div className="text-center py-8">
          <Link to="/offers/negotiate">
            <Button variant="secondary">Back to All Strategies</Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      {/* Context trail */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6 flex-wrap">
        <Link to="/offers" className="hover:text-primary-600 transition-colors">Offers</Link>
        <span>/</span>
        <Link to="/offers/negotiate" className="hover:text-primary-600 transition-colors">Strategies</Link>
        <span>/</span>
        <span className="text-gray-600 truncate">{coach.companyName} — {coach.roleTitle}</span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Negotiation Strategy · {coach.companyName}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{coach.roleTitle}</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/offers/negotiate`}>
            <Button variant="outline" size="sm">All Strategies</Button>
          </Link>
        </div>
      </div>

      {coach.application && (
        <Link
          to={`/applications/${coach.application.id}`}
          className="inline-flex items-center gap-1.5 mb-6 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 transition"
        >
          ↩ From application: {coach.application.companyName} — {coach.application.roleTitle}
        </Link>
      )}

      <Card padding="lg" className="mb-6">
        <NegotiationStrategyView coach={coach} />
      </Card>

      <p className="text-xs text-gray-400">
        Generated {new Date(coach.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
      </p>
    </PageShell>
  );
}
