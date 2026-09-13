import { cn } from "~/lib/utils";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { PageShell, PageHeader, Button, Input, Select, Card, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Equity & RSU Calculator" },
  { name: "description", content: "Calculate equity value with vesting schedules and tax implications" },
];

export default function EquityCalculator() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    roleTitle: "",
    totalShares: "",
    sharePrice: "",
    vestingSchedule: "4 years, 1 year cliff",
    vestingCliff: "12",
    equityType: "RSUs",
    strikePrice: "",
    refreshGrant: "",
    currentSalary: "",
  });

  if (!isPending && !isAuthenticated) {
    navigate("/login");
    return null;
  }

  async function handleCalculate(e?: FormEvent) {
    e?.preventDefault();
    if (!formData.roleTitle || !formData.totalShares || !formData.sharePrice || !formData.currentSalary) return;
    setSaving(true);
    setError("");
    try {
      const data = await api.offerNegotiation.calculateEquity({
        roleTitle: formData.roleTitle,
      } as any);
      setResult(data);
      toastSuccess("Calculation complete", "Equity analysis ready");
    } catch (err) {
      reportError(err, {
        title: "Calculation failed",
        toastError,
        setError,
        retry: handleCalculate,
      });
    }
    setSaving(false);
  }

  function formatMoney(n: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Equity & RSU Calculator"
        subtitle="Calculate equity value with vesting schedules and tax implications"
      />

      {error && <ErrorBanner error={error} onRetry={handleCalculate} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-1">
          <Card className="sticky top-8">
            <form onSubmit={handleCalculate} className="space-y-4">
              <h3 className="font-semibold text-gray-900">Equity Details</h3>

              <Input
                label="Role Title"
                placeholder="e.g. Senior Software Engineer"
                value={formData.roleTitle}
                onChange={(e) => setFormData((p) => ({ ...p, roleTitle: e.target.value }))}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Total Shares"
                  type="number"
                  placeholder="10000"
                  value={formData.totalShares}
                  onChange={(e) => setFormData((p) => ({ ...p, totalShares: e.target.value }))}
                  required
                />
                <Input
                  label="Share Price"
                  type="number"
                  step="0.01"
                  placeholder="45.00"
                  value={formData.sharePrice}
                  onChange={(e) => setFormData((p) => ({ ...p, sharePrice: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Equity Type"
                  value={formData.equityType}
                  onChange={(e) => setFormData((p) => ({ ...p, equityType: e.target.value }))}
                  options={[
                    { value: "RSUs", label: "RSUs" },
                    { value: "ISOs", label: "ISOs (Incentive Stock Options)" },
                    { value: "NSOs", label: "NSOs (Non-Qualified Options)" },
                  ]}
                />
                <Input
                  label="Cliff (months)"
                  type="number"
                  placeholder="12"
                  value={formData.vestingCliff}
                  onChange={(e) => setFormData((p) => ({ ...p, vestingCliff: e.target.value }))}
                />
              </div>

              <Input
                label="Vesting Schedule"
                placeholder="4 years, 1 year cliff"
                value={formData.vestingSchedule}
                onChange={(e) => setFormData((p) => ({ ...p, vestingSchedule: e.target.value }))}
              />

              {formData.equityType !== "RSUs" && (
                <Input
                  label="Strike Price"
                  type="number"
                  step="0.01"
                  placeholder="10.00"
                  value={formData.strikePrice}
                  onChange={(e) => setFormData((p) => ({ ...p, strikePrice: e.target.value }))}
                />
              )}

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Refresh Grant/yr"
                  type="number"
                  placeholder="2000"
                  value={formData.refreshGrant}
                  onChange={(e) => setFormData((p) => ({ ...p, refreshGrant: e.target.value }))}
                />
                <Input
                  label="Current Salary"
                  type="number"
                  placeholder="150000"
                  value={formData.currentSalary}
                  onChange={(e) => setFormData((p) => ({ ...p, currentSalary: e.target.value }))}
                  required
                />
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? "Calculating..." : "Calculate Equity"}
              </Button>
            </form>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-6">
          {!result ? (
            <Card className="text-center py-16">
              <p className="text-gray-500">Fill in your equity details and click "Calculate" to see results.</p>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card>
                <h3 className="font-semibold text-gray-900 mb-2">Summary</h3>
                <p className="text-sm text-gray-700">{result.summary}</p>
              </Card>

              {result.scenarios?.length > 0 && (
                <Card>
                  <h3 className="font-semibold text-gray-900 mb-4">Exit Scenarios</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {result.scenarios.map((s: any) => (
                      <div key={s.name} className={cn("border rounded-lg p-4", s.name.toLowerCase().includes("great") || s.name.toLowerCase().includes("unicorn") ? "border-green-200 bg-green-50" : "border-gray-200")}>
                        <div className="text-sm font-medium text-gray-900 mb-1">{s.name}</div>
                        <div className="text-xs text-gray-500 mb-2">{s.description}</div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm"><span className="text-gray-600">Total Value:</span><span className="font-semibold">{formatMoney(s.totalValue)}</span></div>
                          <div className="flex justify-between text-sm"><span className="text-gray-600">Annual:</span><span className="font-semibold">{formatMoney(s.annualValue)}</span></div>
                          <div className="flex justify-between text-sm"><span className="text-gray-600">After Tax:</span><span className="font-semibold text-green-700">{formatMoney(s.afterTaxEstimate)}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {result.vestingSchedule?.length > 0 && (
                <Card>
                  <h3 className="font-semibold text-gray-900 mb-4">Vesting Schedule</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-3 font-medium text-gray-600">Year</th>
                          <th className="text-right py-2 px-3 font-medium text-gray-600">Vested Shares</th>
                          <th className="text-right py-2 px-3 font-medium text-gray-600">Cumulative Value</th>
                          <th className="text-right py-2 px-3 font-medium text-gray-600">Tax Owed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.vestingSchedule.map((v: any) => (
                          <tr key={v.year} className="border-b border-gray-100">
                            <td className="py-2 px-3">{v.year}</td>
                            <td className="py-2 px-3 text-right">{v.vestedShares.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right font-semibold">{formatMoney(v.cumulativeValue)}</td>
                            <td className="py-2 px-3 text-right text-red-600">{formatMoney(v.taxOwed)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {result.taxBreakdown && (
                <Card>
                  <h3 className="font-semibold text-gray-900 mb-3">Tax Breakdown</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-500">Income Tax Rate</div>
                      <div className="font-bold">{(result.taxBreakdown.ordinaryIncomeRate * 100).toFixed(0)}%</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-500">LTCG Rate</div>
                      <div className="font-bold">{(result.taxBreakdown.longTermCapitalGainsRate * 100).toFixed(0)}%</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <div className="text-xs text-red-500">Est. Tax</div>
                      <div className="font-bold text-red-700">{formatMoney(result.taxBreakdown.estimatedTax)}</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-xs text-green-500">After Tax</div>
                      <div className="font-bold text-green-700">{formatMoney(result.taxBreakdown.afterTaxTotal)}</div>
                    </div>
                  </div>
                </Card>
              )}

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