import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { PageShell, PageHeader, Button, Card } from "~/components/ui";
import { Skeleton } from "~/components/Skeleton";
import { OFFER_STATUS_CONFIG, type OfferStatus } from "~/lib/status-config";
import type { OfferComparisonRow, ComparisonOfferEntry } from "types";

export const meta = () => [
  { title: "Career Autopilot | Offers" },
  { name: "description", content: "Manage and compare job offers" },
];

function formatCurrency(val: number | undefined, currency = "USD", compact = false) {
  if (!val) return "—";
  if (compact) {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${val.toLocaleString()}`;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(val);
}

function StatusBadge({ status }: { status: string }) {
  const config = OFFER_STATUS_CONFIG[status as OfferStatus] || { label: status, color: "text-gray-600", bgColor: "bg-gray-100", borderColor: "border-gray-200" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color} border ${config.borderColor}`}>
      {config.label}
    </span>
  );
}

/** One negotiable offer: an entry from a comparison, with its parent context. */
interface OfferCardData {
  comparisonId: string;
  comparisonName: string;
  entry: ComparisonOfferEntry;
  application?: OfferComparisonRow["application"];
}

export default function Offers() {
  const [comparisons, setComparisons] = useState<OfferComparisonRow[]>([]);
  const [loading, setLoading] = useState(true);

  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    async function load() {
      try {
        const data = await api.offerNegotiation.listComparisons();
        setComparisons(data || []);
      } catch (err) {
        console.error("Failed to load offers:", err);
      }
      setLoading(false);
    }
    load();
  }, [isAuthenticated]);

  // A comparison row is not an offer — each row aggregates several offer
  // entries. Flatten them into negotiable cards with their parent context.
  const offerCards: OfferCardData[] = comparisons.flatMap((c) =>
    (c.offers || []).map((entry) => ({
      comparisonId: c.id,
      comparisonName: c.name,
      entry,
      application: c.application ?? undefined,
    })),
  );

  const activeCards = offerCards.filter((o) => o.entry.baseSalary > 0);
  const compareUrl = (card: OfferCardData) => `/offers/compare?comparison=${card.comparisonId}`;
  const negotiateUrl = (card: OfferCardData) =>
    `/offers/negotiate?${new URLSearchParams({
      company: card.entry.name,
      baseSalary: String(card.entry.baseSalary),
      ...(card.entry.equity ? { equity: String(card.entry.equity) } : {}),
      ...(card.entry.bonus ? { bonus: String(card.entry.bonus) } : {}),
      ...(card.entry.location ? { location: card.entry.location } : {}),
      ...(card.application ? { applicationId: card.application.id, role: card.application.roleTitle } : {}),
    }).toString()}`;

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Offers" subtitle="Loading..." />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Job Offers"
        subtitle="Track, compare, and negotiate your offers"
        action={<Link to="/offers/compare"><Button>Compare Offers</Button></Link>}
      />

      {/* Active Offers */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Offers to Decide</h2>
        {activeCards.length === 0 ? (
          <Card className="text-center py-12">
            <svg className="size-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No offers yet</h3>
            <p className="text-gray-500 mb-6">When an offer arrives, add it to a comparison — it will show up here ready to negotiate.</p>
            <Button onClick={() => navigate("/offers/compare")}>Add an Offer</Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeCards.map((card, idx) => (
              <Card key={`${card.comparisonId}-${idx}`} className="p-4 flex flex-col hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{card.entry.name}</h3>
                    <p className="text-sm text-gray-500">
                      {card.application ? card.application.roleTitle : card.comparisonName}
                    </p>
                  </div>
                  {card.application && (
                    <StatusBadge status={card.application.status === "offer" ? "pending" : card.application.status === "accepted" ? "accepted" : "negotiating"} />
                  )}
                </div>

                <div className="space-y-2 mb-4 flex-1">
                  {card.application && (
                    <Link
                      to={`/applications/${card.application.id}`}
                      className="block text-xs text-primary-600 hover:underline mb-1"
                    >
                      ↩ From application: {card.application.companyName} — {card.application.roleTitle}
                    </Link>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Base Salary</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(card.entry.baseSalary)}</span>
                  </div>
                  {card.entry.equity > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Equity/yr</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(card.entry.equity)}</span>
                    </div>
                  )}
                  {card.entry.bonus > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Annual Bonus</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(card.entry.bonus)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-sm font-medium text-gray-700">Total Comp</span>
                    <span className="font-bold text-primary-500 text-lg">
                      {formatCurrency(card.entry.baseSalary + card.entry.equity + card.entry.bonus)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <Link to={compareUrl(card)} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">Compare</Button>
                  </Link>
                  <Link to={negotiateUrl(card)} className="flex-1">
                    <Button size="sm" className="w-full">Negotiate</Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Comparisons */}
      {comparisons.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Comparisons</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {comparisons.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{c.name}</h3>
                    <p className="text-sm text-gray-500">
                      {c.offers.length} offer{c.offers.length !== 1 ? "s" : ""}
                      {c.application ? ` · from ${c.application.companyName}` : ""}
                    </p>
                  </div>
                  <Link to={compareUrl({ comparisonId: c.id, comparisonName: c.name, entry: c.offers[0] })}>
                    <Button variant="outline" size="sm">Open</Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}
