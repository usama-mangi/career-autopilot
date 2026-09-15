import type { BenefitsAnalysisResult } from "types";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import { PageShell, PageHeader, Button, Input, Card, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Benefits Analyzer" },
  { name: "description", content: "Compare and analyze employee benefits packages against market standards" },
];

function getRatingColor(rating: string) {
  switch (rating) {
    case "excellent": return "bg-green-100 text-green-700";
    case "good": return "bg-success-50 text-success-700";
    case "average": return "bg-warning-50 text-warning-700";
    case "below_average": return "bg-warning-50 text-warning-700";
    case "poor": return "bg-red-100 text-red-700";
    default: return "bg-gray-100 text-gray-700";
  }
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function BenefitsAnalyzer() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [benefitInput, setBenefitInput] = useState("");

  const [formData, setFormData] = useState({
    roleTitle: "",
    companyName: "",
    salary: "",
    benefits: [] as Array<{ name: string; value: string; category: string }>,
  });

  if (!isPending && !isAuthenticated) {
    navigate("/login");
    return null;
  }

  function addBenefit() {
    if (!benefitInput.trim()) return;
    setFormData(p => ({ ...p, benefits: [...p.benefits, { name: benefitInput.trim(), value: benefitInput.trim(), category: "general" }] }));
    setBenefitInput("");
  }

  function removeBenefit(idx: number) {
    setFormData(p => ({ ...p, benefits: p.benefits.filter((_, i) => i !== idx) }));
  }

  async function handleAnalyze(e?: React.FormEvent) {
    e?.preventDefault();
    if (!formData.roleTitle || !formData.companyName || !formData.salary || formData.benefits.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const data = await api.offerNegotiation.analyzeBenefits({
        roleTitle: formData.roleTitle,
        companyName: formData.companyName,
        benefits: formData.benefits,
        salary: formData.salary,
      });
      setResult(data);
      toastSuccess("Analysis complete", "Your benefits analysis is ready");
    } catch (err) {
      reportError(err, {
        title: "Analysis failed",
        toastError,
        setError,
        retry: handleAnalyze,
      });
    }
    setSaving(false);
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Benefits Analyzer"
        subtitle="Compare and analyze employee benefits packages against market standards"
      />

      {error && <ErrorBanner error={error} onRetry={handleAnalyze} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-1">
          <Card className="sticky top-8">
            <form onSubmit={handleAnalyze} className="space-y-4">
              <h3 className="font-semibold text-gray-900">Benefits Details</h3>

              <Input
                label="Company Name"
                placeholder="e.g. Google"
                value={formData.companyName}
                onChange={(e) => setFormData(p => ({ ...p, companyName: e.target.value }))}
                required
              />

              <Input
                label="Role Title"
                placeholder="e.g. Senior Software Engineer"
                value={formData.roleTitle}
                onChange={(e) => setFormData(p => ({ ...p, roleTitle: e.target.value }))}
                required
              />

              <Input
                label="Base Salary"
                type="number"
                placeholder="150000"
                value={formData.salary}
                onChange={(e) => setFormData(p => ({ ...p, salary: e.target.value }))}
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Benefits (add one at a time)</label>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="e.g. Health insurance, 401k 4% match"
                    value={benefitInput}
                    onChange={(e) => setBenefitInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addBenefit())}
                  />
                  <Button type="button" variant="secondary" onClick={addBenefit} className="h-10">Add</Button>
                </div>
                {formData.benefits.length > 0 && (
                  <ul className="space-y-1">
                    {formData.benefits.map((b, i) => (
                      <li key={i} className="flex items-center justify-between bg-gray-50 px-3 py-1.5 rounded text-sm">
                        <span>{b.name}</span>
                        <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-700 p-1" onClick={() => removeBenefit(i)}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Button type="submit" disabled={saving || formData.benefits.length === 0} className="w-full">
                {saving ? "Analyzing..." : "Analyze Benefits"}
              </Button>
            </form>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-6">
          {!result ? (
            <Card className="text-center py-16">
              <p className="text-gray-500">Add your benefits and click "Analyze" to see results.</p>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Overall Score */}
              <Card>
                <div className="flex items-center gap-4">
                  <div className={cn("w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white",
                    result.overallScore >= 80 ? "bg-green-500" : result.overallScore >= 60 ? "bg-blue-500" : result.overallScore >= 40 ? "bg-yellow-500" : "bg-red-500"
                  )}>
                    {result.overallScore}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Overall Benefits Score</h3>
                    <p className="text-sm text-gray-600">{result.summary}</p>
                  </div>
                </div>
              </Card>

              {/* Total Comp Value */}
              {result.totalCompensationValue > 0 && (
                <Card className="bg-[#FFF8F0] border border-[#E8DDD1] p-6 text-center">
                  <div className="text-sm text-primary-600 mb-1">Estimated Benefits Value</div>
                  <div className="text-3xl font-bold text-gray-900">{formatMoney(result.totalCompensationValue)}/yr</div>
                </Card>
              )}

              {/* Categories */}
              {result.categories?.length > 0 && (
                <Card>
                  <h3 className="font-semibold text-gray-900 mb-4">Category Breakdown</h3>
                  <div className="space-y-4">
                    {result.categories.map((cat: { name: string; score: number; items: { name: string; value: string; marketBenchmark: string; rating: string; notes?: string }[] }) => (
                      <div key={cat.name} className="border border-gray-100 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-800">{cat.name}</h4>
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", getRatingColor(cat.score >= 8 ? "excellent" : cat.score >= 6 ? "good" : cat.score >= 4 ? "average" : "poor"))}>
                            {cat.score}/10
                          </span>
                        </div>
                        <div className="space-y-2">
                          {cat.items?.map((item: { name: string; value: string; marketBenchmark: string; rating: string; notes?: string }) => (
                            <div key={item.name} className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-700">{item.name}: {item.value}</div>
                                <div className="text-xs text-gray-500">Market: {item.marketBenchmark}</div>
                                {item.notes && <div className="text-xs text-gray-500 mt-0.5">{item.notes}</div>}
                              </div>
                              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap", getRatingColor(item.rating))}>
                                {item.rating.replace(/_/g, " ")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Strengths & Weaknesses */}
              {result.comparison && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-green-50 border border-green-100">
                    <h4 className="font-medium text-green-900 mb-2">Strengths</h4>
                    <ul className="space-y-1">
                      {result.comparison.strengths?.map((s: string, i: number) => (
                        <li key={i} className="text-sm text-green-800">+ {s}</li>
                      ))}
                    </ul>
                  </Card>
                  <Card className="bg-red-50 border border-red-100">
                    <h4 className="font-medium text-red-900 mb-2">Weaknesses</h4>
                    <ul className="space-y-1">
                      {result.comparison.weaknesses?.map((w: string, i: number) => (
                        <li key={i} className="text-sm text-red-800">- {w}</li>
                      ))}
                    </ul>
                  </Card>
                  <Card className="bg-yellow-50 border border-yellow-100">
                    <h4 className="font-medium text-yellow-900 mb-2">Missing vs Market</h4>
                    <ul className="space-y-1">
                      {result.comparison.missingComparedToMarket?.map((m: string, i: number) => (
                        <li key={i} className="text-sm text-yellow-800">! {m}</li>
                      ))}
                    </ul>
                  </Card>
                </div>
              )}

              {/* Recommendations */}
              {result.recommendations?.length > 0 && (
                <Card className="bg-[#FFF8F0] border border-[#E8DDD1]">
                  <h3 className="font-semibold text-gray-900 mb-3">Recommendations</h3>
                  <ul className="space-y-2">
                    {result.recommendations.map((r: string, i: number) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-primary-500 mt-0.5">•</span> {r}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
