import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import { PageShell, PageHeader, Button, Input, Textarea, Card, Modal, ModalFooter, Select, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";
import { MailIcon } from "~/components/ui/icons";
import { suggestFollowUp } from "~/lib/follow-up";

export const meta = () => [
  { title: "Career Autopilot | Follow-up Email Templates" },
  { name: "description", content: "Thank-you notes, check-ins, and follow-up emails" },
];

const emailTypes = [
  { value: "thank_you", label: "Thank You" },
  { value: "check_in", label: "Check-in" },
  { value: "additional_materials", label: "Additional Materials" },
  { value: "custom", label: "Custom" },
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
  const [genTiming, setGenTiming] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    interviewNoteId: string;
    applicationId: string;
    type: "thank_you" | "check_in" | "additional_materials" | "custom";
    subject: string;
    body: string;
  }>({
    interviewNoteId: "",
    applicationId: "",
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
        applicationId: formData.applicationId || undefined,
        type: formData.type,
        subject: formData.subject,
        body: formData.body,
      });
      setEmails(prev => [email, ...prev]);
      setShowForm(false);
      setFormData({ interviewNoteId: "", applicationId: "", type: "thank_you", subject: "", body: "" });
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
      // The generate endpoint takes the role/company/interviewer context, not
      // ids; the created email is linked to the note (and its application)
      // when the user saves the draft.
      const result = await api.interviewProcess.generateFollowUpEmail({
        type: genData.type,
        roleTitle: genData.roleTitle,
        companyName: genData.companyName,
        interviewerName: genData.interviewerName || undefined,
        additionalContext: genData.additionalContext || undefined,
      });
      const linkedNote = genData.interviewNoteId
        ? notes.find(n => n.id === genData.interviewNoteId)
        : null;
      setFormData({
        interviewNoteId: genData.interviewNoteId,
        applicationId: linkedNote?.applicationId || "",
        type: genData.type,
        subject: result.subject,
        body: result.body,
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
            <Button variant="secondary" onClick={() => { setGenTiming(""); setShowGenerate(true); }}>
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
                    <span className="flex items-center justify-center size-10 rounded-lg bg-[#F5EDE4] text-gray-600 shrink-0">
                      <MailIcon className="size-5" />
                    </span>
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
        onClose={() => { setShowForm(false); setFormData({ interviewNoteId: "", applicationId: "", type: "thank_you", subject: "", body: "" }); }}
        title="New Follow-up Email"
        size="xl"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {error && <ErrorBanner error={error} />}
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Linked Interview Note"
              value={formData.interviewNoteId}
              onChange={(e) => {
                const note = notes.find(n => n.id === e.target.value);
                setFormData(prev => ({
                  ...prev,
                  interviewNoteId: e.target.value,
                  applicationId: note?.applicationId || "",
                }));
              }}
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
              { label: "Cancel", variant: "secondary", onClick: () => { setShowForm(false); setFormData({ interviewNoteId: "", applicationId: "", type: "thank_you", subject: "", body: "" }); } },
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
          {error && <ErrorBanner error={error} />}            <Select
              label="Linked Interview Note"
              value={genData.interviewNoteId}
              onChange={(e) => {
                const note = notes.find(n => n.id === e.target.value);
                setGenData(prev => ({
                  ...prev,
                  interviewNoteId: e.target.value,
                  companyName: note?.companyName || prev.companyName,
                  roleTitle: note?.roleTitle || prev.roleTitle,
                }));
                // Suggest type + timing from the selected note instead of
                // leaving every draft on thank_you.
                if (note) {
                  // No specific chip context here — suggest from the note's
                  // first follow-up item; already-sent email types still
                  // steer the suggestion inside suggestFollowUp.
                  const item = note.followUpItems[0] || "follow up";
                  const suggestion = suggestFollowUp(note, item, emails);
                  setGenData(prev => ({ ...prev, type: suggestion.type }));
                  setGenTiming(suggestion.timing);
                } else {
                  setGenTiming("");
                }
              }}
              options={[
                { value: "", label: "None" },
                ...notes.map(n => ({ value: n.id, label: `${n.companyName} — ${n.roleTitle} (R${n.roundNumber})` })),
              ]}
            />
          <Select
            label="Email Type (suggested)"
            value={genData.type}
            onChange={(e) => setGenData({ ...genData, type: e.target.value as "thank_you" | "check_in" | "additional_materials" | "custom" })}
            options={emailTypes.map(t => ({ value: t.value, label: t.label }))}
          />
          {genTiming && (
            <p className="text-xs text-primary-700 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2">
              ⏱ {genTiming}
            </p>
          )}
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