import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import { PageShell, PageHeader, Button, Input, Textarea, Select, Card, Modal, ModalFooter, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Interviewer Feedback" },
  { name: "description", content: "Capture post-interview feedback from interviewers and internal assessments" },
];

const recommendations = [
  { value: "strong_hire", label: "Strong Hire", class: "bg-green-100 text-green-700" },
  { value: "hire", label: "Hire", class: "bg-blue-100 text-blue-700" },
  { value: "neutral", label: "Neutral", class: "bg-yellow-100 text-yellow-700" },
  { value: "no_hire", label: "No Hire", class: "bg-orange-100 text-orange-700" },
  { value: "strong_no_hire", label: "Strong No Hire", class: "bg-red-100 text-red-700" },
];

export default function InterviewerFeedback() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [notes, setNotes] = useState<any[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string>("");
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<{
    interviewerName: string;
    interviewerRole: string;
    rating: number;
    feedbackText: string;
    recommendation: "strong_hire" | "hire" | "neutral" | "no_hire" | "strong_no_hire";
    strengths: string;
    concerns: string;
  }>({
    interviewerName: "",
    interviewerRole: "",
    rating: 3,
    feedbackText: "",
    recommendation: "hire",
    strengths: "",
    concerns: "",
  });

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadNotes();
  }, [isAuthenticated]);

  async function loadNotes() {
    setLoading(true);
    try {
      const data = await api.interviewProcess.listNotes();
      setNotes(data);
    } catch (err) {
      console.error("Failed to load notes:", err);
    }
    setLoading(false);
  }

  async function loadFeedbacks(noteId: string) {
    setSelectedNoteId(noteId);
    if (!noteId) { setFeedbacks([]); return; }
    try {
      const data = await api.interviewProcess.listFeedbacks(noteId);
      setFeedbacks(data);
    } catch (err) {
      console.error("Failed to load feedbacks:", err);
    }
  }

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!selectedNoteId || !formData.interviewerName || !formData.feedbackText) return;
    setSaving(true);
    setError("");
    try {
      const fb = await api.interviewProcess.addFeedback(selectedNoteId, {
        interviewerName: formData.interviewerName,
        interviewerRole: formData.interviewerRole || undefined,
        rating: formData.rating,
        feedbackText: formData.feedbackText,
        recommendation: formData.recommendation,
        strengths: formData.strengths ? formData.strengths.split(",").map(s => s.trim()).filter(Boolean) : [],
        concerns: formData.concerns ? formData.concerns.split(",").map(s => s.trim()).filter(Boolean) : [],
      });
      setFeedbacks(prev => [fb, ...prev]);
      setShowForm(false);
      setFormData({ interviewerName: "", interviewerRole: "", rating: 3, feedbackText: "", recommendation: "hire", strengths: "", concerns: "" });
      toastSuccess("Feedback saved");
    } catch (err) {
      reportError(err, { title: "Save failed", toastError, setError, retry: handleCreate });
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this feedback?")) return;
    try {
      await api.interviewProcess.deleteFeedback(id);
      setFeedbacks(prev => prev.filter(f => f.id !== id));
      toastSuccess("Feedback deleted");
    } catch (err) {
      reportError(err, { title: "Delete failed", toastError });
    }
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Interviewer Feedback"
        subtitle="Capture post-interview feedback and internal assessments"
        action={<Button onClick={() => setShowForm(true)} disabled={!selectedNoteId}>+ Add Feedback</Button>}
      />

      {error && <ErrorBanner error={error} />}

      {/* Note Selector */}
      <Card>
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Interview Note</label>
        {loading ? (
          <p className="text-gray-500">Loading notes...</p>
        ) : notes.length === 0 ? (
          <p className="text-gray-500">No interview notes found. <a href="/interview-notes" className="text-primary-500 hover:underline">Create one first</a>.</p>
        ) : (
          <Select
            value={selectedNoteId}
            onChange={e => loadFeedbacks(e.target.value)}
            options={[
              { value: "", label: "-- Select an interview note --" },
              ...notes.map(n => ({ value: n.id, label: `${n.companyName} — ${n.roleTitle} (Round ${n.roundNumber}, ${new Date(n.interviewDate).toLocaleDateString()})` }))
            ]}
          />
        )}
      </Card>

      {/* Feedback List */}
      {!selectedNoteId ? (
        <Card className="text-center py-12">
          <p className="text-gray-500">Select an interview note above to view feedbacks.</p>
        </Card>
      ) : feedbacks.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-500">No feedback recorded yet. Click "Add Feedback" to get started.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {feedbacks.map(fb => {
            const rec = recommendations.find(r => r.value === fb.recommendation);
            return (
              <Card key={fb.id}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white",
                        fb.rating >= 4 ? "bg-green-500" : fb.rating >= 3 ? "bg-blue-500" : "bg-yellow-500"
                      )}>
                        {fb.rating}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{fb.interviewerName}</h3>
                        {fb.interviewerRole && <p className="text-sm text-gray-500">{fb.interviewerRole}</p>}
                      </div>
                      {rec && <span className={cn("text-xs font-medium px-2 py-1 rounded-full", rec.class)}>{rec.label}</span>}
                    </div>
                    <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap">{fb.feedbackText}</p>
                    <div className="flex gap-4 flex-wrap">
                      {fb.strengths?.length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-green-700">Strengths: </span>
                          {fb.strengths.map((s: string, i: number) => (
                            <span key={i} className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full mr-1">{s}</span>
                          ))}
                        </div>
                      )}
                      {fb.concerns?.length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-red-700">Concerns: </span>
                          {fb.concerns.map((c: string, i: number) => (
                            <span key={i} className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full mr-1">{c}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(fb.id)}>Delete</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Add Interviewer Feedback"
        size="xl"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <ErrorBanner error={error} className="mb-0" />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Interviewer Name"
              placeholder="e.g. Sarah Chen"
              value={formData.interviewerName}
              onChange={(e) => setFormData(p => ({ ...p, interviewerName: e.target.value }))}
              required
            />
            <Input
              label="Role / Title"
              placeholder="e.g. Engineering Manager"
              value={formData.interviewerRole}
              onChange={(e) => setFormData(p => ({ ...p, interviewerRole: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rating: {formData.rating}/5</label>
            <div className="flex gap-2">
              {[1,2,3,4,5].map(i => (
                <button key={i} type="button" onClick={() => setFormData(p => ({ ...p, rating: i }))} className={cn("w-12 h-12 rounded-lg font-bold text-lg transition-colors", formData.rating === i ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>{i}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recommendation</label>
            <div className="flex gap-2 flex-wrap">
              {recommendations.map(r => (
                <button key={r.value} type="button" onClick={() => setFormData(p => ({ ...p, recommendation: r.value as "strong_hire" | "hire" | "neutral" | "no_hire" | "strong_no_hire" }))} className={cn("px-3 py-1.5 rounded-full text-sm font-medium transition-colors", formData.recommendation === r.value ? r.class : "bg-gray-100 text-gray-600")}>{r.label}</button>
              ))}
            </div>
          </div>

          <Textarea
            label="Feedback Text"
            placeholder="Detailed feedback about the candidate..."
            rows={4}
            value={formData.feedbackText}
            onChange={(e) => setFormData(p => ({ ...p, feedbackText: e.target.value }))}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Strengths (comma-separated)"
              value={formData.strengths}
              onChange={(e) => setFormData(p => ({ ...p, strengths: e.target.value }))}
            />
            <Input
              label="Concerns (comma-separated)"
              value={formData.concerns}
              onChange={(e) => setFormData(p => ({ ...p, concerns: e.target.value }))}
            />
          </div>

          <ModalFooter
            actions={[
              { label: "Cancel", variant: "secondary", onClick: () => { setShowForm(false); setFormData({ interviewerName: "", interviewerRole: "", rating: 3, feedbackText: "", recommendation: "hire", strengths: "", concerns: "" }); } },
              { label: saving ? "Saving..." : "Save Feedback", variant: "primary", onClick: handleCreate, loading: saving },
            ]}
          />
        </form>
      </Modal>
    </PageShell>
  );
}