import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import { PageShell, PageHeader, Button, Input, Textarea, Select, Card, Modal, ModalFooter, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Salary Negotiation Coach" },
  { name: "description", content: "AI-powered salary negotiation strategy with scripts and email templates" },
];

export default function SalaryNegotiation() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [coaches, setCoaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    companyName: "",
    roleTitle: "",
    jobDescription: "",
    resumeText: "",
    baseSalary: "",
    equity: "",
    equityType: "RSUs",
    bonus: "",
    signOn: "",
    benefits: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadCoaches();
  }, [isAuthenticated]);

  async function loadCoaches() {
    setLoading(true);
    try {
      const data = await api.offerNegotiation.listCoaches();
      setCoaches(data);
    } catch (err) {
      console.error("Failed to load coaches:", err);
    }
    setLoading(false);
  }

  function handleInputChange(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
  }

  function validateForm() {
    const newErrors: Record<string, string> = {};
    if (!formData.companyName.trim()) newErrors.companyName = "Company name is required";
    if (!formData.roleTitle.trim()) newErrors.roleTitle = "Role title is required";
    if (!formData.baseSalary.trim()) newErrors.baseSalary = "Base salary is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleCreate(e?: FormEvent) {
    e?.preventDefault();
    if (!validateForm()) return;
    setSaving(true);
    setErrors({});

    try {
      const result = await api.offerNegotiation.createCoach({
        companyName: formData.companyName,
        roleTitle: formData.roleTitle,
      } as any);
      setCoaches(prev => [result, ...prev]);
      setShowForm(false);
      resetForm();
      toastSuccess("Strategy generated", "Your negotiation coach is ready");
    } catch (err) {
      reportError(err, {
        title: "Generation failed",
        toastError,
        setError: (message) => setErrors({ general: message }),
        retry: handleCreate,
      });
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this negotiation coach?")) return;
    try {
      await api.offerNegotiation.deleteCoach(id);
      setCoaches(prev => prev.filter(c => c.id !== id));
      if (expandedId === id) setExpandedId(null);
      toastSuccess("Deleted", "Coach removed");
    } catch (err) {
      reportError(err, { title: "Delete failed", toastError });
    }
  }

  function resetForm() {
    setFormData({ companyName: "", roleTitle: "", jobDescription: "", resumeText: "", baseSalary: "", equity: "", equityType: "RSUs", bonus: "", signOn: "", benefits: "" });
  }

  function formatMoney(n: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  }

  function getScoreColor(score: number) {
    if (score >= 70) return "text-green-600";
    if (score >= 40) return "text-yellow-600";
    return "text-red-600";
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Salary Negotiation Coach" subtitle="Loading..." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Card key={i} className="h-48 animate-pulse bg-gray-100"><div className="h-full" /></Card>)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Salary Negotiation Coach"
        subtitle="AI-powered negotiation strategy with scripts and email templates"
        action={<Button onClick={() => { resetForm(); setShowForm(true); }}>+ New Strategy</Button>}
      />

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : coaches.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-500">No negotiation strategies yet. Click "New Strategy" to get started.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {coaches.map(coach => (
            <Card key={coach.id} hover onClick={() => setExpandedId(expandedId === coach.id ? null : coach.id)}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{coach.companyName} — {coach.roleTitle}</h3>
                  <p className="text-sm text-gray-500">{new Date(coach.createdAt).toLocaleDateString()}</p>
                </div>
                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDelete(coach.id); }}>Delete</Button>
              </div>

              {expandedId === coach.id && (
                <div className="border-t border-gray-100 pt-6 mt-4 space-y-6">
                  {/* Strategy */}
                  {coach.strategy && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Negotiation Strategy</h4>
                      <Card>
                        <p className="text-sm text-gray-700 mb-3">{coach.strategy.overallApproach}</p>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <div className="text-xs text-blue-600">Anchor</div>
                            <div className="font-bold text-blue-900">{formatMoney(coach.strategy.anchorPoint)}</div>
                          </div>
                          <div className="text-center p-3 bg-green-50 rounded-lg">
                            <div className="text-xs text-green-600">Target</div>
                            <div className="font-bold text-green-900">{formatMoney(coach.strategy.targetPoint)}</div>
                          </div>
                          <div className="text-center p-3 bg-red-50 rounded-lg">
                            <div className="text-xs text-red-600">Walk Away</div>
                            <div className="font-bold text-red-900">{formatMoney(coach.strategy.walkAwayPoint)}</div>
                          </div>
                        </div>
                        {coach.strategy.keyLeveragePoints?.length > 0 && (
                          <div className="mb-3">
                            <h5 className="text-sm font-medium text-gray-700 mb-1">Key Leverage Points</h5>
                            <ul className="space-y-1">
                              {coach.strategy.keyLeveragePoints.map((lp: string, i: number) => (
                                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                  <span className="text-indigo-500 mt-0.5">•</span> {lp}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {coach.strategy.stepByStep?.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Step-by-Step Plan</h5>
                            <div className="space-y-2">
                              {coach.strategy.stepByStep.map((step: any) => (
                                <div key={step.step} className="flex gap-3 items-start">
                                  <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full mt-0.5">{step.step}</span>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-800">{step.action}</p>
                                    {step.script && <p className="text-xs text-gray-500 mt-1 italic">"{step.script}"</p>}
                                    {step.tip && <p className="text-xs text-blue-600 mt-1">Tip: {step.tip}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </Card>
                    </div>
                  )}

                  {/* Email Templates */}
                  {coach.emailTemplates?.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Email Templates</h4>
                      <div className="space-y-3">
                        {coach.emailTemplates.map((tpl: any, i: number) => (
                          <Card key={i} padding="md">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-full capitalize">{tpl.type?.replace(/_/g, " ")}</span>
                              <span className="text-sm font-medium text-gray-700">{tpl.subject}</span>
                            </div>
                            <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans">{tpl.body}</pre>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Scripts */}
                  {coach.scripts?.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Conversation Scripts</h4>
                      <div className="space-y-3">
                        {coach.scripts.map((script: any, i: number) => (
                          <Card key={i} padding="md">
                            <h5 className="font-medium text-gray-800 mb-2">{script.scenario}</h5>
                            <p className="text-sm text-gray-600 mb-2"><strong>Opening:</strong> "{script.opening}"</p>
                            {script.keyPoints?.length > 0 && (
                              <ul className="space-y-1 mb-2">
                                {script.keyPoints.map((kp: string, ki: number) => (
                                  <li key={ki} className="text-sm text-gray-600">• {kp}</li>
                                ))}
                              </ul>
                            )}
                            <p className="text-sm text-gray-600 italic">Closing: "{script.closing}"</p>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); resetForm(); }}
        title="Negotiation Strategy"
        size="xl"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Company Name"
              placeholder="e.g. Google"
              value={formData.companyName}
              onChange={(e) => handleInputChange("companyName", e.target.value)}
              error={errors.companyName}
              required
            />
            <Input
              label="Role Title"
              placeholder="e.g. Senior Software Engineer"
              value={formData.roleTitle}
              onChange={(e) => handleInputChange("roleTitle", e.target.value)}
              error={errors.roleTitle}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Base Salary"
              type="number"
              placeholder="150000"
              value={formData.baseSalary}
              onChange={(e) => handleInputChange("baseSalary", e.target.value)}
              error={errors.baseSalary}
              required
            />
            <Input
              label="Equity/yr"
              type="number"
              placeholder="50000"
              value={formData.equity}
              onChange={(e) => handleInputChange("equity", e.target.value)}
            />
            <Select
              label="Equity Type"
              value={formData.equityType}
              onChange={(e) => handleInputChange("equityType", e.target.value)}
              options={[
                { value: "RSUs", label: "RSUs" },
                { value: "Stock Options", label: "Stock Options" },
                { value: "Phantom Stock", label: "Phantom Stock" },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Bonus"
              type="number"
              placeholder="20000"
              value={formData.bonus}
              onChange={(e) => handleInputChange("bonus", e.target.value)}
            />
            <Input
              label="Sign-on Bonus"
              type="number"
              placeholder="10000"
              value={formData.signOn}
              onChange={(e) => handleInputChange("signOn", e.target.value)}
            />
          </div>

          <Input
            label="Benefits (comma-separated)"
            placeholder="Health insurance, 401k match, etc."
            value={formData.benefits}
            onChange={(e) => handleInputChange("benefits", e.target.value)}
          />

          <Textarea
            label="Job Description (optional)"
            rows={3}
            value={formData.jobDescription}
            onChange={(e) => handleInputChange("jobDescription", e.target.value)}
          />

          <Textarea
            label="Your Resume Text (optional)"
            rows={3}
            value={formData.resumeText}
            onChange={(e) => handleInputChange("resumeText", e.target.value)}
          />

          {errors.general && <ErrorBanner error={errors.general} onRetry={handleCreate} className="mb-0" />}

          <ModalFooter
            actions={[
              { label: "Cancel", variant: "secondary", onClick: () => { setShowForm(false); resetForm(); } },
              { label: saving ? "Generating..." : "Generate Strategy", variant: "primary", onClick: handleCreate, loading: saving },
            ]}
          />
        </form>
      </Modal>
    </PageShell>
  );
}