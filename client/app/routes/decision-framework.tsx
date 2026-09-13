import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import type { OfferItem } from "types";
import { PageShell, PageHeader, Button, Input, Textarea, Select, useToastHelpers, Modal, ModalFooter, ScoreBadge, Card, ScoreCell, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Decision Framework" },
  { name: "description", content: "Weighted decision matrix for comparing job offers" },
];

const defaultCriteria = [
  { id: "comp", name: "Compensation", weight: 30 },
  { id: "growth", name: "Growth Opportunities", weight: 20 },
  { id: "culture", name: "Company Culture", weight: 15 },
  { id: "wlb", name: "Work-Life Balance", weight: 15 },
  { id: "mission", name: "Mission Alignment", weight: 10 },
  { id: "location", name: "Location/Remote", weight: 10 },
];

interface LocalCriterion {
  id: string;
  name: string;
  weight: number;
}

interface LocalOffer {
  id: string;
  name: string;
  baseSalary: number;
  equity: number;
  bonus: number;
  location: string;
  remotePolicy: string;
  benefits: string;
  pto: number;
  growthOpportunities: number;
  companyCulture: number;
  scores?: Record<string, number>;
}

interface LocalDecision {
  id: string;
  name: string;
  criteria: LocalCriterion[];
  offers: LocalOffer[];
  createdAt: string;
}

export default function DecisionFramework() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [decisions, setDecisions] = useState<LocalDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [decisionName, setDecisionName] = useState("");
  const [criteria, setCriteria] = useState<LocalCriterion[]>(defaultCriteria);
  const [offers, setOffers] = useState<LocalOffer[]>([
    { id: "1", name: "", baseSalary: 0, equity: 0, bonus: 0, location: "", remotePolicy: "", benefits: "", pto: 0, growthOpportunities: 0, companyCulture: 0 },
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadDecisions();
  }, [isAuthenticated]);

  async function loadDecisions() {
    setLoading(true);
    try {
      const data = await api.offerNegotiation.listDecisions?.() || [];
      setDecisions(data as unknown as LocalDecision[]);
    } catch (err) {
      console.error("Failed to load decisions:", err);
    }
    setLoading(false);
  }

  function updateCriterion(id: string, field: keyof LocalCriterion, value: string | number) {
    setCriteria((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  }

  function addCriterion() {
    setCriteria((prev) => [...prev, { id: crypto.randomUUID(), name: "", weight: 0 }]);
  }

  function removeCriterion(id: string) {
    setCriteria((prev) => prev.filter((c) => c.id !== id));
  }

  function updateOffer(id: string, field: keyof LocalOffer, value: string | number) {
    setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, [field]: value } : o)));
  }

  function addOffer() {
    setOffers((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", baseSalary: 0, equity: 0, bonus: 0, location: "", remotePolicy: "", benefits: "", pto: 0, growthOpportunities: 0, companyCulture: 0 },
    ]);
  }

  function removeOffer(id: string) {
    setOffers((prev) => prev.filter((o) => o.id !== id));
  }

  async function handleCreate(e?: FormEvent) {
    e?.preventDefault();
    if (!decisionName.trim() || offers.some((o) => !o.name.trim())) return;
    const totalWeight = criteria.reduce((sum, c) => sum + (c.weight || 0), 0);
    if (totalWeight !== 100) {
      setErrors({ weight: "Criteria weights must sum to 100%" });
      return;
    }
    setSaving(true);
    setErrors({});

    try {
      const formattedOffers = offers.map((o, index) => ({
        id: o.id || `offer-${index}`,
        name: o.name,
        baseSalary: o.baseSalary,
        equity: o.equity || 0,
        equityType: "",
        bonus: o.bonus || 0,
        signOn: 0,
        location: o.location || "",
        remotePolicy: o.remotePolicy || "",
        benefits: o.benefits ? [o.benefits] : [],
        growthOpportunities: o.growthOpportunities || 0,
        companyCulture: o.companyCulture || 0,
        pto: o.pto || 0,
      })) as unknown as OfferItem[];

      const result = await (api.offerNegotiation as any).createDecision?.({
        name: decisionName,
        criteria: criteria.map((c) => ({ id: c.id, name: c.name, weight: c.weight, score: 0, reasoning: "" })),
        offers: formattedOffers,
      });

      if (result) {
        setDecisions((prev) => [result as unknown as LocalDecision, ...prev]);
        setShowForm(false);
        resetForm();
        toastSuccess("Decision framework created");
      }
    } catch (err) {
      reportError(err, {
        title: "Creation failed",
        toastError,
        setError: (message) => setErrors({ general: message }),
        retry: handleCreate,
      });
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this decision framework?")) return;
    try {
      await api.offerNegotiation.deleteDecision?.(id);
      setDecisions((prev) => prev.filter((d) => d.id !== id));
      if (expandedId === id) setExpandedId(null);
      toastSuccess("Deleted", "Framework removed");
    } catch (err) {
      reportError(err, { title: "Delete failed", toastError });
    }
  }

  function resetForm() {
    setDecisionName("");
    setCriteria(defaultCriteria);
    setOffers([
      { id: "1", name: "", baseSalary: 0, equity: 0, bonus: 0, location: "", remotePolicy: "", benefits: "", pto: 0, growthOpportunities: 0, companyCulture: 0 },
    ]);
  }

  function getScoreColor(score: number) {
    if (score >= 70) return "text-green-600";
    if (score >= 40) return "text-yellow-600";
    return "text-red-600";
  }

  function calculateScores(decision: LocalDecision) {
    return decision.offers.map((offer: LocalOffer) => {
      let total = 0;
      decision.criteria.forEach((c: LocalCriterion) => {
        const score = offer.scores?.[c.id] || 0;
        total += score * (c.weight / 100);
      });
      return { offerId: offer.id, total: Math.round(total) };
    });
  }

  if (loading) {
    return (
      <PageShell maxWidth="2xl">
        <PageHeader title="Decision Framework" subtitle="Weighted decision matrix for comparing job offers" />
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Decision Framework"
        subtitle="Weighted decision matrix: compensation, growth, culture, mission, location, WLB"
        action={<Button onClick={() => setShowForm(true)}>+ New Decision</Button>}
      />

      {errors.general && <ErrorBanner error={errors.general} onRetry={handleCreate} />}

      {decisions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500">No decision frameworks yet. Click "New Decision" to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {decisions.map((decision) => {
            const scores = calculateScores(decision);
            const bestOffer = (scores as any[]).reduce((best: any, curr: any) => (curr.total > best.total ? curr : best), scores[0]);
            return (
              <div onClick={() => setExpandedId(expandedId === decision.id ? null : decision.id)} className="cursor-pointer">
                <Card key={decision.id} hover>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{decision.name}</h3>
                    <p className="text-sm text-gray-500">
                      {decision.offers.length} offer{decision.offers.length !== 1 ? "s" : ""} · {decision.criteria.length} criteria · Created {new Date(decision.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(decision.id);
                    }}
                    className="text-red-400 hover:text-red-600 text-sm"
                  >
                    Delete
                  </button>
                </div>

                {expandedId === decision.id && (
                  <div className="border-t border-gray-100 pt-6 mt-4 space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {decision.offers.map((offer) => {
                        const scoreData = scores.find((s) => s.offerId === offer.id);
                        const isBest = scoreData?.total === bestOffer.total;
                        return (
                          <Card key={offer.id} className={cn(isBest && "ring-2 ring-green-500")}>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-gray-900">{offer.name}</h4>
                              {isBest && <ScoreBadge score={100} size="sm" showLabel={false} variant="compact" />}
                            </div>
                            <div className="text-3xl font-bold {getScoreColor(scoreData?.total || 0)}">
                              {scoreData?.total || 0}/100
                            </div>
                            <p className="text-xs text-gray-500 mt-1">${offer.baseSalary.toLocaleString()} base + ${offer.equity.toLocaleString()} equity</p>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Criteria Weights */}
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Criteria Weights</h4>
                      <div className="flex flex-wrap gap-2">
                        {decision.criteria.map((c) => (
                          <span key={c.id} className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
                            {c.name}: {c.weight}%
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Detailed Scores Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[600px]">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Criterion</th>
                            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Weight</th>
                            {decision.offers.map((o) => (
                              <th key={o.id} className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                {o.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {decision.criteria.map((c) => (
                            <tr key={c.id} className="border-b border-gray-100">
                              <td className="py-2 px-3 font-medium text-gray-700">{c.name}</td>
                              <td className="py-2 px-3 text-gray-500">{c.weight}%</td>
                              {decision.offers.map((o) => (
                                <td key={o.id} className="text-center py-2 px-3">
                                  <ScoreCell score={o.scores?.[c.id] || 0} size="sm" />
                                </td>
                              ))}
                            </tr>
                          ))}
                          <tr className="bg-gray-50 font-bold">
                            <td className="py-2 px-3 text-gray-700">Weighted Total</td>
                            <td className="py-2 px-3 text-gray-500">100%</td>
                            {decision.offers.map((o) => {
                              const scoreData = scores.find((s) => s.offerId === o.id);
                              return (
                                <td key={o.id} className="text-center py-2 px-3">
                                  <span className={cn("font-bold", getScoreColor(scoreData?.total || 0))}>
                                    {scoreData?.total || 0}/100
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>
            </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title="New Decision Framework" size="xl">
        <form onSubmit={handleCreate} className="space-y-6">
          <Input
            label="Decision Name"
            placeholder="e.g. Senior Engineer Offers - Q1 2025"
            value={decisionName}
            onChange={(e) => setDecisionName(e.target.value)}
            required
          />

          {/* Criteria */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Criteria (weights must total 100%)</h4>
            <div className="space-y-2">
              {criteria.map((c, i) => (
                <div key={c.id} className="flex gap-2 items-center">
                  <Input
                    label={i === 0 ? "Criterion Name" : ""}
                    placeholder="e.g. Compensation"
                    value={c.name}
                    onChange={(e) => updateCriterion(c.id, "name", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    label={i === 0 ? "Weight %" : ""}
                    type="number"
                    min="0"
                    max="100"
                    value={c.weight}
                    onChange={(e) => updateCriterion(c.id, "weight", Number(e.target.value))}
                    className="w-24"
                  />
                  {criteria.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCriterion(c.id)}
                      className="p-2 text-red-400 hover:text-red-600"
                      aria-label="Remove criterion"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-gray-500">Total: {criteria.reduce((sum, c) => sum + (c.weight || 0), 0)}%</span>
              <Button type="button" variant="ghost" size="sm" onClick={addCriterion}>+ Add Criterion</Button>
            </div>
            {errors.weight && <p className="mt-1 text-sm text-red-600">{errors.weight}</p>}
          </div>

          {/* Offers */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Job Offers</h4>
            <div className="space-y-4">
              {offers.map((o, i) => (
                <Card key={o.id} padding="md">
                  <div className="flex items-start justify-between mb-4">
                    <h5 className="font-medium text-gray-900">Offer {i + 1}</h5>
                    {offers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeOffer(o.id)}
                        className="p-2 text-red-400 hover:text-red-600"
                        aria-label="Remove offer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <Input
                      label="Company Name"
                      placeholder="e.g. Google"
                      value={o.name}
                      onChange={(e) => updateOffer(o.id, "name", e.target.value)}
                      required
                    />
                    <Input
                      label="Base Salary"
                      type="number"
                      placeholder="150000"
                      value={o.baseSalary}
                      onChange={(e) => updateOffer(o.id, "baseSalary", Number(e.target.value))}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <Input
                      label="Equity/yr"
                      type="number"
                      placeholder="50000"
                      value={o.equity}
                      onChange={(e) => updateOffer(o.id, "equity", Number(e.target.value))}
                    />
                    <Input
                      label="Annual Bonus"
                      type="number"
                      placeholder="20000"
                      value={o.bonus}
                      onChange={(e) => updateOffer(o.id, "bonus", Number(e.target.value))}
                    />
                    <Select
                      label="Remote Policy"
                      value={o.remotePolicy}
                      onChange={(e) => updateOffer(o.id, "remotePolicy", e.target.value)}
                      options={[
                        { value: "remote", label: "Fully Remote" },
                        { value: "hybrid", label: "Hybrid" },
                        { value: "onsite", label: "On-site" },
                      ]}
                      placeholder="Select..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <Input
                      label="Location"
                      placeholder="San Francisco, CA"
                      value={o.location}
                      onChange={(e) => updateOffer(o.id, "location", e.target.value)}
                    />
                    <Input
                      label="PTO (days)"
                      type="number"
                      placeholder="15"
                      value={o.pto}
                      onChange={(e) => updateOffer(o.id, "pto", Number(e.target.value))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <Input
                      label="Benefits (comma-separated)"
                      placeholder="Health, 401k match, etc."
                      value={o.benefits}
                      onChange={(e) => updateOffer(o.id, "benefits", e.target.value)}
                    />
                    <Select
                      label="Growth Opportunities"
                      value={o.growthOpportunities}
                      onChange={(e) => updateOffer(o.id, "growthOpportunities", Number(e.target.value))}
                      options={[
                        { value: "100", label: "Excellent (100)" },
                        { value: "80", label: "Good (80)" },
                        { value: "60", label: "Average (60)" },
                        { value: "40", label: "Limited (40)" },
                        { value: "20", label: "Minimal (20)" },
                      ]}
                      placeholder="Rate growth..."
                    />
                  </div>

                  <Select
                    label="Company Culture"
                    value={o.companyCulture}
                    onChange={(e) => updateOffer(o.id, "companyCulture", Number(e.target.value))}
                    options={[
                      { value: "100", label: "Excellent (100)" },
                      { value: "80", label: "Good (80)" },
                      { value: "60", label: "Average (60)" },
                      { value: "40", label: "Below Average (40)" },
                      { value: "20", label: "Poor (20)" },
                    ]}
                    placeholder="Rate culture..."
                  />
                </Card>
              ))}
            </div>
            <Button type="button" variant="secondary" onClick={addOffer}>+ Add Another Offer</Button>
          </div>

          {errors.general && <p className="text-sm text-red-600">{errors.general}</p>}

          <ModalFooter
            actions={[
              { label: "Cancel", variant: "secondary", onClick: () => { setShowForm(false); resetForm(); } },
              { label: saving ? "Creating..." : "Create Framework", variant: "primary", onClick: async (e: React.FormEvent) => { e.preventDefault(); await handleCreate(e); }, loading: saving },
            ]}
          />
        </form>
      </Modal>
    </PageShell>
  );
}