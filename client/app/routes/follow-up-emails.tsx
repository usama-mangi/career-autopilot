import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import { PageShell, PageHeader, Button, Input, Textarea, Card, Modal, ModalFooter, Select, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Follow-up Email Templates" },
  { name: "description", content: "Thank-you notes, check-ins, and follow-up emails" },
];

const emailTypes = [
  { value: "thank_you", label: "Thank You", icon: "🙏" },
  { value: "check_in", label: "Check-in", icon: "👋" },
  { value: "additional_materials", label: "Additional Materials", icon: "📎" },
  { value: "custom", label: "Custom", icon: "✉️" },
];

export default function FollowUpEmails() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [emails, setEmails] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    interviewNoteId: string;
    type: "thank_you" | "check_in" | "additional_materials" | "custom";
    subject: string;
    body: string;
  }>({
    interviewNoteId: "",
    type: "thank_you",
    subject: "",
    body: "",
  });

  const [genData, setGenData] = useState<{
    interviewNoteId: string;
    type: "thank_you" | "check_in" | "additional_materials" | "custom";
    companyName: string;
    roleTitle: string;
    interviewerName: string;
    additionalContext: string;
  }>({
    interviewNoteId: "",
    type: "thank_you",
    companyName: "",
    roleTitle: "",
    interviewerName: "",
    additionalContext: "",
  });

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadData();
  }, [isAuthenticated]);

  async function loadData() {
    setLoading(true);
    try {
      const [emailData, noteData] = await Promise.all([
        api.interviewProcess.listFollowUpEmails(),
        api.interviewProcess.listNotes(),
      ]);
      setEmails(emailData);
      setNotes(noteData);
    } catch (err) {
      console.error("Failed to load data:", err);
    }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.subject || !formData.body) return;
    setSaving(true);
    setError("");
    try {
      const email = await api.interviewProcess.createFollowUpEmail({
        interviewNoteId: formData.interviewNoteId || undefined,
        type: formData.type,
        subject: formData.subject,
        body: formData.body,
      });
      setEmails(prev => [email, ...prev]);
      setShowForm(false);
      setFormData({ interviewNoteId: "", type: "thank_you", subject: "", body: "" });
      toastSuccess("Email saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create email");
    }
    setSaving(false);
  }

  async function handleGenerate(e?: React.FormEvent) {
    e?.preventDefault();
    setGenerating(true);
    setError("");
    try {
      const result = await api.interviewProcess.generateFollowUpEmail({
        applicationId: genData.interviewNoteId || undefined,
        type: genData.type as any,
        context: [genData.companyName, genData.roleTitle, genData.interviewerName, genData.additionalContext].filter(Boolean).join(" "),
      });
      setFormData({
        interviewNoteId: genData.interviewNoteId,
        type: genData.type as any,
        subject: result.subject,
        body: result.body || result.content || "",
      });
      setShowGenerate(false);
      setShowForm(true);
      setSuccess("Email generated! Review and edit before saving.");
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

  async function handleDelete(id: string) {
    if (!confirm("Delete this email?")) return;
    try {
      await api.interviewProcess.deleteFollowUpEmail(id);
      setEmails(prev => prev.filter(e => e.id !== id));
      toastSuccess("Email deleted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function copyToClipboard(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const filtered = filter === "all" ? emails : emails.filter(e => e.type === filter);

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Follow-up Email Templates"
        subtitle="Thank-you notes, check-ins, and additional materials"
        action={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowGenerate(true)}>
              <span className="flex items-center gap-1">AI Generate</span>
            </Button>
            <Button onClick={() => setShowForm(true)}>+ New Email</Button>
          </div>
        }
      />

      {error && <ErrorBanner error={error} onRetry={handleGenerate} />}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">{success}</div>}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[{ value: "all", label: "All" }, ...emailTypes].map(t => (
          <Button key={t.value} variant={filter === t.value ? "primary" : "outline"} size="sm" onClick={() => setFilter(t.value)}>
            {t.label}
          </Button>
        ))}
      </div>

      {/* Email List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-500">No follow-up emails yet. Create one manually or use AI generation.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map(email => {
            const typeInfo = emailTypes.find(t => t.value === email.type);
            return (
              <Card key={email.id}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{typeInfo?.icon || "✉️"}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{email.subject}</h3>
                      <p className="text-sm text-gray-500">
                        {typeInfo?.label} · {new Date(email.createdAt).toLocaleDateString()}
                        {email.sentAt && ` · Sent ${new Date(email.sentAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(email.body, email.id)}>
                      {copiedId === email.id ? "Copied!" : "Copy"}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(email.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto">{email.body}</div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setFormData({ interviewNoteId: "", type: "thank_you", subject: "", body: "" }); }}
        title="New Follow-up Email"
        size="xl"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {error && <ErrorBanner error={error} />}
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Linked Interview Note"
              value={formData.interviewNoteId}
              onChange={(e) => setFormData({ ...formData, interviewNoteId: e.target.value })}
              options={[
                { value: "", label: "None" },
                ...notes.map(n => ({ value: n.id, label: `${n.companyName} — ${n.roleTitle} (R${n.roundNumber})` })),
              ]}
            />
            <Select
              label="Email Type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as "thank_you" | "check_in" | "additional_materials" | "custom" })}
              options={emailTypes.map(t => ({ value: t.value, label: t.label }))}
            />
          </div>
          <Input
            label="Subject"
            placeholder="e.g. Thank you for the interview"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            required
          />
          <Textarea
            label="Body"
            placeholder="Write your email here..."
            rows={8}
            value={formData.body}
            onChange={(e) => setFormData({ ...formData, body: e.target.value })}
            required
          />
          <ModalFooter
            actions={[
              { label: "Cancel", variant: "secondary", onClick: () => { setShowForm(false); setFormData({ interviewNoteId: "", type: "thank_you", subject: "", body: "" }); } },
              { label: saving ? "Saving..." : "Save Email", variant: "primary", onClick: handleCreate, loading: saving },
            ]}
          />
        </form>
      </Modal>

      {/* AI Generate Modal */}
      <Modal
        isOpen={showGenerate}
        onClose={() => setShowGenerate(false)}
        title="AI Email Generator"
        size="lg"
      >
        <form onSubmit={handleGenerate} className="space-y-4">
          {error && <ErrorBanner error={error} />}
          <Select
            label="Linked Interview Note"
            value={genData.interviewNoteId}
            onChange={(e) => setGenData({ ...genData, interviewNoteId: e.target.value })}
            options={[
              { value: "", label: "None" },
              ...notes.map(n => ({ value: n.id, label: `${n.companyName} — ${n.roleTitle} (R${n.roundNumber})` })),
            ]}
          />
          <Select
            label="Email Type"
            value={genData.type}
            onChange={(e) => setGenData({ ...genData, type: e.target.value as "thank_you" | "check_in" | "additional_materials" | "custom" })}
            options={emailTypes.map(t => ({ value: t.value, label: t.label }))}
          />
          <Input
            label="Company Name"
            placeholder="e.g. Google"
            value={genData.companyName}
            onChange={(e) => setGenData({ ...genData, companyName: e.target.value })}
            required
          />
          <Input
            label="Role Title"
            placeholder="e.g. Senior Software Engineer"
            value={genData.roleTitle}
            onChange={(e) => setGenData({ ...genData, roleTitle: e.target.value })}
            required
          />
          <Input
            label="Interviewer Name (optional)"
            placeholder="e.g. Sarah Johnson"
            value={genData.interviewerName}
            onChange={(e) => setGenData({ ...genData, interviewerName: e.target.value })}
          />
          <Textarea
            label="Additional Context (optional)"
            placeholder="Any specific topics discussed, challenges mentioned, etc."
            rows={3}
            value={genData.additionalContext}
            onChange={(e) => setGenData({ ...genData, additionalContext: e.target.value })}
          />
          <ModalFooter
            actions={[
              { label: "Cancel", variant: "secondary", onClick: () => setShowGenerate(false) },
              { label: generating ? "Generating..." : "Generate Email", variant: "primary", onClick: handleGenerate, loading: generating },
            ]}
          />
        </form>
      </Modal>
    </PageShell>
  );
}