import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import { PageShell, PageHeader, Button, Input, Textarea, Select, Card, Modal, ModalFooter, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";
import NegotiationStrategyView from "~/components/NegotiationStrategyView";

export const meta = () => [
  { title: "Career Autopilot | Salary Negotiation Coach" },   { name: "description", content: "Salary negotiation strategy with scripts and email templates" },
];

export default function SalaryNegotiation() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();
  const [searchParams] = useSearchParams();

  const [coaches, setCoaches] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    applicationId: "",
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
    if (isAuthenticated) {
      loadCoaches();
      loadApplications();
    }
  }, [isAuthenticated]);

  async function loadApplications() {
    try {
      const data = await api.applications.list({ limit: 100 });
      setApplications(data.applications || []);
    } catch {
      // The selector stays empty; linking a session to an application is optional.
    }
  }

  // Arriving from an application ("Negotiation coach") or an offer card
  // ("Negotiate") pre-fills the form — identity from the application params,
  // the money from the offer being negotiated — and links the session back.
  useEffect(() => {
    const applicationId = searchParams.get("applicationId");
    const company = searchParams.get("company");
    const baseSalary = searchParams.get("baseSalary");
    if (!applicationId && !company && !baseSalary) return;
    setFormData((prev) => ({
      ...prev,
      applicationId: applicationId || prev.applicationId,
      companyName: company || prev.companyName,
      roleTitle: searchParams.get("role") || prev.roleTitle,
      baseSalary: baseSalary || prev.baseSalary,
      equity: searchParams.get("equity") || prev.equity,
      bonus: searchParams.get("bonus") || prev.bonus,
      jobDescription: searchParams.get("location")
        ? `Location: ${searchParams.get("location")}`
        : prev.jobDescription,
    }));
    setShowForm(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        applicationId: formData.applicationId || undefined,
        companyName: formData.companyName,
        roleTitle: formData.roleTitle,
        jobDescription: formData.jobDescription || undefined,
        resumeText: formData.resumeText || undefined,
        offerDetails: {
          baseSalary: Number(formData.baseSalary) || 0,
          equity: formData.equity ? Number(formData.equity) : undefined,
          equityType: formData.equity || undefined,
          bonus: formData.bonus ? Number(formData.bonus) : undefined,
          signOn: formData.signOn ? Number(formData.signOn) : undefined,
          benefits: formData.benefits
            ? formData.benefits.split(",").map((b) => b.trim()).filter(Boolean)
            : undefined,
        },
      });
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
    setFormData({ applicationId: "", companyName: "", roleTitle: "", jobDescription: "", resumeText: "", baseSalary: "", equity: "", equityType: "RSUs", bonus: "", signOn: "", benefits: "" });
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
        subtitle="Negotiation strategy with scripts and email templates"
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
                <p className="text-sm text-gray-500">
                  {new Date(coach.createdAt).toLocaleDateString()}
                  {coach.application && (
                    <> · from <Link to={`/applications/${coach.application.id}`} className="text-primary-600 hover:underline">{coach.application.companyName} — {coach.application.roleTitle}</Link></>
                  )}
                </p>
              </div>
                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDelete(coach.id); }}>Delete</Button>
              </div>

              {expandedId === coach.id && (
                <div className="border-t border-gray-100 pt-6 mt-4">
                  <NegotiationStrategyView coach={coach} />
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Linked application</label>
            <select
              value={formData.applicationId}
              onChange={(e) => handleInputChange("applicationId", e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              <option value="">Not linked (standalone session)</option>
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.companyName} — {a.roleTitle}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Linking keeps your negotiation strategy with the job it belongs to.</p>
          </div>

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