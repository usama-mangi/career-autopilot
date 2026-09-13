import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { PageShell, PageHeader, Button, Input, Textarea, Card, Modal, ModalFooter, Select, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Resignation Letter Generator" },
  { name: "description", content: "Professional resignation letter templates with notice period, transition plan, and bridge-burning avoidance" },
];

export default function ResignationLetter() {
  const { id } = useParams();
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [letter, setLetter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingLetter, setEditingLetter] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    companyName: "",
    roleTitle: "",
    lastDay: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    noticePeriod: "2 weeks",
    reason: "",
    transitionPlan: "",
    tone: "professional",
    includePersonalNote: false,
    personalNote: "",
  });

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadLetter();
  }, [isAuthenticated, id]);

  async function loadLetter() {
    if (!id) return;
    try {
      const data = await api.offerNegotiation.getResignationLetter(id);
      setLetter(data);
    } catch (err) {
      console.error("Failed to load letter:", err);
    }
    setLoading(false);
  }

  function resetForm() {
    setFormData({
      companyName: "",
      roleTitle: "",
      lastDay: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      noticePeriod: "2 weeks",
      reason: "",
      transitionPlan: "",
      tone: "professional",
      includePersonalNote: false,
      personalNote: "",
    });
    setEditingLetter(null);
    setError("");
    setSuccess("");
  }

  async function handleGenerate() {
    if (!formData.companyName.trim() || !formData.roleTitle.trim()) return;
    setGenerating(true);
    setError("");
    setLetter(null);
    try {
      const result = await api.offerNegotiation.generateResignationLetter(formData as any);
      setLetter(result);
      toastSuccess("Letter generated", "Your resignation letter is ready");
    } catch (err) {
      reportError(err, {
        title: "Generation failed",
        toastError,
        setError,
        retry: handleGenerate,
      });
    }
    setGenerating(false);
  }

  async function handleRegenerate() {
    setLetter(null);
    await handleGenerate();
  }

  async function handleCopy() {
    if (!letter) return;
    try {
      await navigator.clipboard.writeText(letter.content);
      toastSuccess("Copied", "Letter copied to clipboard");
    } catch {
      toastError("Failed to copy", "Please copy manually");
    }
  }

  async function handleDownload() {
    if (!letter) return;
    const blob = new Blob([letter.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resignation-letter-${letter.companyName}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Resignation Letter Generator" subtitle="Loading..." />
        <Card className="h-64 animate-pulse bg-gray-100"><div className="h-full" /></Card>
      </PageShell>
    );
  }

  if (!isPending && !isAuthenticated) return null;

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Resignation Letter Generator"
        subtitle={
          !generating && !letter
            ? "Professional templates with notice period, transition plan, and bridge-burning avoidance"
            : generating
              ? "Crafting your professional resignation letter..."
              : "Your resignation letter is ready!"
        }
      />

      {error && <ErrorBanner error={error} onRetry={handleGenerate} />}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">{success}</div>}

      {!letter && !generating ? (
        <Card className="max-w-2xl">
          <form onSubmit={handleGenerate} className="space-y-4">
            <h3 className="font-semibold text-gray-900">Generate New Letter</h3>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Company Name"
                placeholder="e.g. Google"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                required
              />
              <Input
                label="Your Role Title"
                placeholder="e.g. Senior Software Engineer"
                value={formData.roleTitle}
                onChange={(e) => setFormData({ ...formData, roleTitle: e.target.value })}
                required
              />
            </div>

            <Input
              label="Last Working Day"
              type="date"
              value={formData.lastDay}
              onChange={(e) => setFormData({ ...formData, lastDay: e.target.value })}
              required
            />

            <Select
              label="Notice Period"
              value={formData.noticePeriod}
              onChange={(e) => setFormData({ ...formData, noticePeriod: e.target.value })}
              options={[
                { value: "2 weeks", label: "2 weeks" },
                { value: "1 month", label: "1 month" },
                { value: "3 months", label: "3 months" },
                { value: "custom", label: "Custom" },
              ]}
            />

            <Select
              label="Tone"
              value={formData.tone}
              onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
              options={[
                { value: "professional", label: "Professional" },
                { value: "warm", label: "Warm & Grateful" },
                { value: "formal", label: "Formal" },
                { value: "concise", label: "Concise" },
              ]}
            />

            <Textarea
              label="Reason for Leaving (optional)"
              placeholder="e.g. Pursuing new opportunity, Career growth, Relocation..."
              rows={2}
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            />

            <Textarea
              label="Transition Plan (optional)"
              placeholder="e.g. Document current projects, train replacement, handover documentation..."
              rows={3}
              value={formData.transitionPlan}
              onChange={(e) => setFormData({ ...formData, transitionPlan: e.target.value })}
            />

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="personalNote"
                checked={formData.includePersonalNote}
                onChange={(e) => setFormData({ ...formData, includePersonalNote: e.target.checked })}
                className="w-4 h-4 text-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="personalNote" className="text-sm text-gray-700">Include personal thank-you note</label>
            </div>

            {formData.includePersonalNote && (
              <Textarea
                label="Personal Note"
                placeholder="Add a personal message to your manager/team..."
                rows={3}
                value={formData.personalNote}
                onChange={(e) => setFormData({ ...formData, personalNote: e.target.value })}
              />
            )}

            <Button type="submit" disabled={generating} className="w-full">
              {generating ? "Generating..." : "Generate Resignation Letter"}
            </Button>
          </form>
        </Card>
      ) : generating ? (
        <Card className="text-center py-12">
          <img src="/images/resume-scan.gif" className="w-64 mx-auto" alt="Processing" />
          <p className="mt-4 text-sm text-gray-500 animate-pulse">
            Crafting a professional resignation letter with smooth transition plan...
          </p>
        </Card>
      ) : letter && (
        <div className="space-y-6 animate-in fade-in duration-1000">
          <div className="flex flex-row gap-3 justify-end">
            <Button variant="secondary" onClick={handleCopy}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy
            </Button>
            <Button variant="secondary" onClick={handleDownload}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download .txt
            </Button>
            <Link to="/" className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Back to Home
            </Link>
          </div>

          <Card className="bg-white border border-gray-200 p-8 prose prose-sm max-w-none">
            {letter.content}
          </Card>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Next Steps</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Review the letter for accuracy and personal touches</li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Schedule a meeting with your manager to deliver the news in person</li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Prepare your transition plan document for handover</li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Request an exit interview if desired</li>
              <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">✓</span> Update LinkedIn and notify your network after departure</li>
            </ul>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={handleRegenerate}>Regenerate</Button>
          </div>
        </div>
      )}
    </PageShell>
  );
}