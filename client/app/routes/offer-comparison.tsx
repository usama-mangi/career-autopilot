import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import { PageShell, PageHeader, Button, Input, Textarea, Card, Modal, ModalFooter, Select, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Offer Comparison" },
  { name: "description", content: "Side-by-side offer comparison with weighted decision matrix" },
];

export default function OfferComparison() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [comparisons, setComparisons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingComparison, setEditingComparison] = useState<any | null>(null);
  const [viewingComparison, setViewingComparison] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [generating, setGenerating] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    offers: [] as { name: string; baseSalary: number; equity: number; bonus: number; location: string; remotePolicy: string; benefits: string; pto: number; growthOpportunities: number; companyCulture: number }[],
    criteria: [] as { name: string; weight: number }[],
  });

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadComparisons();
  }, [isAuthenticated]);

  async function loadComparisons() {
    try {
      const data = await api.offerNegotiation.listComparisons();
      setComparisons(data);
    } catch (err) {
      console.error("Failed to load comparisons:", err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      name: "",
      offers: [{ name: "", baseSalary: 0, equity: 0, bonus: 0, location: "", remotePolicy: "", benefits: "", pto: 0, growthOpportunities: 0, companyCulture: 0 }],
      criteria: [{ name: "Compensation", weight: 30 }, { name: "Growth", weight: 20 }, { name: "Culture", weight: 15 }, { name: "Work-Life Balance", weight: 15 }, { name: "Mission", weight: 10 }, { name: "Location/Remote", weight: 10 }],
    });
    setEditingComparison(null);
    setError("");
    setSuccess("");
  }

  function addOffer() {
    setFormData((prev) => ({
      ...prev,
      offers: [...prev.offers, { name: "", baseSalary: 0, equity: 0, bonus: 0, location: "", remotePolicy: "", benefits: "", pto: 0, growthOpportunities: 0, companyCulture: 0 }],
    }));
  }

  function removeOffer(index: number) {
    if (formData.offers.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      offers: prev.offers.filter((_, i) => i !== index),
    }));
  }

  function updateOffer(index: number, field: keyof typeof formData.offers[0], value: string | number) {
    setFormData((prev) => ({
      ...prev,
      offers: prev.offers.map((o, i) => (i === index ? { ...o, [field]: value } : o)),
    }));
  }

  function addCriterion() {
    setFormData((prev) => ({
      ...prev,
      criteria: [...prev.criteria, { name: "", weight: 0 }],
    }));
  }

  function removeCriterion(index: number) {
    if (formData.criteria.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      criteria: prev.criteria.filter((_, i) => i !== index),
    }));
  }

  function updateCriterion(index: number, field: "name" | "weight", value: string | number) {
    setFormData((prev) => ({
      ...prev,
      criteria: prev.criteria.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    }));
  }

  function calculateScores(comparison: any) {
    return comparison.offers.map((offer: any) => {
      let total = 0;
      comparison.criteria.forEach((c: any) => {
        const score = offer[c.name.toLowerCase().replace(/\s+/g, "")] || 0;
        total += score * (c.weight / 100);
      });
      return { offerId: offer.id || offer.name, total: Math.round(total) };
    });
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!formData.name.trim() || formData.offers.some((o: any) => !o.name.trim())) return;
    const totalWeight = formData.criteria.reduce((sum: number, c: any) => sum + (c.weight || 0), 0);
    if (totalWeight !== 100) {
      setError("Criteria weights must sum to 100%");
      return;
    }
    const isEditing = !!editingComparison;
    setGenerating(true);
    setError("");
    try {
      const payload = { ...formData } as any;
      if (editingComparison) {
        await api.offerNegotiation.updateComparison(editingComparison.id, payload);
        toastSuccess("Comparison updated");
      } else {
        await  (api.offerNegotiation as any).createComparison(payload);
        toastSuccess("Comparison created");
      }
      setShowForm(false);
      resetForm();
      loadComparisons();
    } catch (err: any) {
      reportError(err, { title: "Save failed", toastError, setError, retry: handleSubmit });
    }
    setGenerating(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this comparison?")) return;
    try {
      await  (api.offerNegotiation as any).deleteComparison(id);
      setComparisons((prev) => prev.filter((c) => c.id !== id));
      toastSuccess("Comparison deleted");
    } catch (err) {
      reportError(err, { title: "Delete failed", toastError });
    }
  }

  function formatMoney(n: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Offer Comparison" subtitle="Loading..." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Card key={i} className="h-48 animate-pulse bg-gray-100"><div className="h-full" /></Card>)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Offer Comparison Matrix"
        subtitle="Side-by-side comparison with weighted decision framework"
        action={<Button onClick={() => { resetForm(); setShowForm(true); }}>+ New Comparison</Button>}
      />

      {error && <ErrorBanner error={error} />}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">{success}</div>}

      {comparisons.length === 0 ? (
        <Card className="text-center py-12">
          <svg className="mx-auto size-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2V8a2 2 0 012-2h4a2 2 0 012 2v2h4a2 2 0 002-2V8a2 2 0 00-2-2h-2a2 2 0 01-2-2V4a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 012-2h2a2 2 0 012 2v2h4a2 2 0 012 2v2h4a2 2 0 012 2v2h4a2 2 0 012 2v2h4a2 2 0 012 2v2h4a2 2 0 012 2v2h4a2 2 0 012 2v2h4a2 2 0 012 2v2h4a2 2 0 012 2v2h4a2 2 0 012 2v2h4a2 2 0 012 2v2h4a2 2 0 012 2v2h4a2 2 0 012 2v2" />
          </svg>
          <p className="mt-4 text-gray-500">No comparisons yet. Create your first offer comparison!</p>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="mt-4">Create Comparison</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {comparisons.map((comparison) => {
            const scores = calculateScores(comparison);
            const bestScore = Math.max(...scores.map((s: any) => s.total));
            return (
              <Card key={comparison.id} hover onClick={() => setViewingComparison(viewingComparison === comparison.id ? null : comparison.id)}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{comparison.name}</h3>
                    <p className="text-sm text-gray-500">{comparison.offers.length} offers · {comparison.criteria.length} criteria</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditingComparison(comparison); setFormData({ ...comparison }); setShowForm(true); }}>Edit</Button>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={(e) => { e.stopPropagation(); handleDelete(comparison.id); }}>Delete</Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Offer</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Base</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Equity</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Bonus</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                        <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {comparison.offers.map((offer: any, i: number) => {
                        const score = scores.find((s: any) => s.offerId === offer.name || s.offerId === i)?.total || 0;
                        return (
                          <tr key={offer.name || i} className="hover:bg-gray-50">
                            <td className="py-3 px-3 font-medium text-gray-900">{offer.name}</td>
                            <td className="py-3 px-3 text-right text-gray-700">{formatMoney(offer.baseSalary)}</td>
                            <td className="py-3 px-3 text-right text-gray-700">{formatMoney(offer.equity)}/yr</td>
                            <td className="py-3 px-3 text-right text-gray-700">{formatMoney(offer.bonus)}</td>
                            <td className="py-3 px-3 text-right font-semibold text-gray-900">{formatMoney(offer.baseSalary + offer.equity + offer.bonus)}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${score >= 80 ? "bg-green-100 text-green-700" : score >= 60 ? "bg-blue-100 text-blue-700" : score >= 40 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                                {score}/100
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {viewingComparison?.id === comparison.id && (
                  <div className="mt-6 pt-6 border-t border-gray-200 animate-in fade-in duration-300">
                    <h4 className="font-semibold text-gray-900 mb-4">Detailed Breakdown</h4>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {comparison.offers.map((offer: any, i: number) => (
                        <Card key={offer.name} padding="md" className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="font-semibold text-gray-900">{offer.name}</h5>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${scores.find((s: any) => s.offerId === offer.name || s.offerId === i)?.total >= 80 ? "bg-[#ECFDF5] text-[#065F46]" : "bg-gray-100 text-gray-700"}`}>
                              {scores.find((s: any) => s.offerId === offer.name || s.offerId === i)?.total || 0}/100
                            </span>
                          </div>
                          <div className="space-y-1 text-sm text-gray-600">
                            <div className="flex justify-between"><span>Base Salary</span><span className="font-medium">{formatMoney(offer.baseSalary)}</span></div>
                            <div className="flex justify-between"><span>Equity/yr</span><span className="font-medium">{formatMoney(offer.equity)}</span></div>
                            <div className="flex justify-between"><span>Annual Bonus</span><span className="font-medium">{formatMoney(offer.bonus)}</span></div>
                            <div className="flex justify-between border-t border-gray-100 pt-1"><span className="font-medium">Total Comp</span><span className="font-bold text-primary-600">{formatMoney(offer.baseSalary + offer.equity + offer.bonus)}</span></div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                            <div><span className="font-medium">Location:</span> {offer.location || "—"}</div>
                            <div><span className="font-medium">Remote:</span> {offer.remotePolicy || "—"}</div>
                            <div><span className="font-medium">PTO:</span> {offer.pto} days</div>
                            <div><span className="font-medium">Growth:</span> {offer.growthOpportunities}/100</div>
                            <div><span className="font-medium">Culture:</span> {offer.companyCulture}/100</div>
                            <div><span className="font-medium">Remote:</span> {offer.remotePolicy}</div>
                          </div>
                          {offer.benefits && <p className="text-xs text-gray-500 mt-2">{offer.benefits}</p>}
                        </Card>
                      ))}
                    </div>

                    {/* Criteria Weights */}
                    <div>
                      <h5 className="font-semibold text-gray-900 mb-3">Criteria Weights</h5>
                      <div className="space-y-2">
                        {comparison.criteria.map((c: any) => (
                          <div key={c.name} className="flex items-center gap-3">
                            <span className="flex-1 text-sm font-medium text-gray-700">{c.name}</span>
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div className="bg-primary-500 h-2 rounded-full" style={{ width: `${c.weight}%` }}></div>
                            </div>
                            <span className="text-sm font-medium text-gray-500 w-10 text-right">{c.weight}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingComparison ? "Edit Comparison" : "New Offer Comparison"} size="xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <ErrorBanner error={error} className="mb-0" />}
          <Input label="Comparison Name" placeholder="e.g. Senior Engineer Offers - Q1 2025" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900">Job Offers</h4>
              <Button type="button" variant="outline" size="sm" onClick={addOffer}>+ Add Offer</Button>
            </div>
            <div className="space-y-4">
              {formData.offers.map((offer: any, i: number) => (
                <Card key={i} padding="md" className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="font-medium text-gray-900">Offer {i + 1}</h5>
                    {formData.offers.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => removeOffer(i)}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Offer Name"
                      placeholder="e.g. Google, Amazon"
                      value={offer.name}
                      onChange={(e) => updateOffer(i, "name", e.target.value)}
                      required
                    />
                    <Input
                      label="Base Salary"
                      type="number"
                      min="0"
                      value={offer.baseSalary}
                      onChange={(e) => updateOffer(i, "baseSalary", Number(e.target.value))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Equity (annual)"
                      type="number"
                      min="0"
                      value={offer.equity}
                      onChange={(e) => updateOffer(i, "equity", Number(e.target.value))}
                    />
                    <Input
                      label="Annual Bonus"
                      type="number"
                      min="0"
                      value={offer.bonus}
                      onChange={(e) => updateOffer(i, "bonus", Number(e.target.value))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Location"
                      placeholder="e.g. San Francisco, CA"
                      value={offer.location}
                      onChange={(e) => updateOffer(i, "location", e.target.value)}
                    />
                    <Input
                      label="Remote Policy"
                      placeholder="Remote, Hybrid, On-site"
                      value={offer.remotePolicy}
                      onChange={(e) => updateOffer(i, "remotePolicy", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <Input
                      label="Benefits"
                      placeholder="Health, 401k, etc."
                      value={offer.benefits}
                      onChange={(e) => updateOffer(i, "benefits", e.target.value)}
                    />
                    <Input
                      label="PTO Days"
                      type="number"
                      min="0"
                      value={offer.pto}
                      onChange={(e) => updateOffer(i, "pto", Number(e.target.value))}
                    />
                    <Input
                      label="Growth Opportunities (0-100)"
                      type="number"
                      min="0"
                      max="100"
                      value={offer.growthOpportunities}
                      onChange={(e) => updateOffer(i, "growthOpportunities", Number(e.target.value))}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <Input
                      label="Company Culture (0-100)"
                      type="number"
                      min="0"
                      max="100"
                      value={offer.companyCulture}
                      onChange={(e) => updateOffer(i, "companyCulture", Number(e.target.value))}
                    />
                    <Input
                      label="Remote Policy"
                      placeholder="e.g. Fully remote, 3 days in office"
                      value={offer.remotePolicy}
                      onChange={(e) => updateOffer(i, "remotePolicy", e.target.value)}
                    />
                  </div>
                </Card>
              ))}
            </div>

            <Button type="button" variant="outline" size="sm" onClick={addOffer}>+ Add Another Offer</Button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900">Criteria Weights (must total 100%)</h4>
              <Button type="button" variant="ghost" size="sm" onClick={addCriterion}>+ Add Criterion</Button>
            </div>
            <div className="space-y-2">
              {formData.criteria.map((criterion: any, i: number) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    label={i === 0 ? "Criterion Name" : ""}
                    placeholder="e.g. Compensation"
                    value={criterion.name}
                    onChange={(e) => updateCriterion(i, "name", e.target.value)}
                    className="flex-1"
                    required
                  />
                  <Input
                    label={i === 0 ? "Weight %" : ""}
                    type="number"
                    min="0"
                    max="100"
                    value={criterion.weight}
                    onChange={(e) => updateCriterion(i, "weight", Number(e.target.value))}
                    className="w-24"
                    required
                  />
                  {formData.criteria.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => removeCriterion(i)}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </Button>
                  )}
                </div>
              ))}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm text-gray-500">Total: {formData.criteria.reduce((sum: number, c: any) => sum + (c.weight || 0), 0)}%</span>
                {formData.criteria.reduce((sum: number, c: any) => sum + (c.weight || 0), 0) !== 100 && (
                  <span className="text-sm text-red-500">Must equal 100%</span>
                )}
              </div>
            </div>
          </div>

          <ModalFooter
            actions={[
              { label: "Cancel", variant: "secondary", onClick: () => { setShowForm(false); resetForm(); } },
              { label: generating ? "Saving..." : (editingComparison ? "Update Comparison" : "Create Comparison"), variant: "primary", onClick: handleSubmit, loading: generating },
            ]}
          />
        </form>
      </Modal>
    </PageShell>
  );
}