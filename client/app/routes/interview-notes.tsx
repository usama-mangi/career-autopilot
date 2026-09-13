import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import { PageShell, PageHeader, Button, Input, Textarea, Card, Modal, ModalFooter, Select, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Interview Notes" },
  { name: "description", content: "Structured interview notes with questions, answers, and ratings" },
];

export default function InterviewNotes() {
  const { id } = useParams();
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    roundNumber: 1,
    type: "video",
    interviewerName: "",
    scheduledAt: new Date().toISOString().slice(0, 16),
    duration: 60,
    overallRating: 5,
    strengths: "",
    weaknesses: "",
    questions: [] as { question: string; answer: string; rating: number }[],
    followUpItems: "",
    nextSteps: "",
  });

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadNotes();
  }, [isAuthenticated]);

  async function loadNotes() {
    try {
      const data = await api.interviewProcess.listNotes();
      setNotes(data);
    } catch (err) {
      console.error("Failed to load notes:", err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      roundNumber: 1,
      type: "video",
      interviewerName: "",
      scheduledAt: new Date().toISOString().slice(0, 16),
      duration: 60,
      overallRating: 5,
      strengths: "",
      weaknesses: "",
      questions: [],
      followUpItems: "",
      nextSteps: "",
    });
    setEditingNote(null);
    setError("");
  }

  function addQuestion() {
    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions, { question: "", answer: "", rating: 5 }]
    }));
  }

  function removeQuestion(index: number) {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }));
  }

  function updateQuestion(index: number, field: "question" | "answer" | "rating", value: string | number) {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => i === index ? { ...q, [field]: value } : q)
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.interviewerName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const payload = { ...formData, interviewId: id, companyName: "", roleTitle: "", interviewType: formData.type, interviewDate: new Date().toISOString(), roundNumber: 1, selfRating: formData.overallRating, strengths: formData.strengths ? formData.strengths.split(",").map(s => s.trim()).filter(Boolean) : [], weaknesses: formData.weaknesses ? formData.weaknesses.split(",").map(s => s.trim()).filter(Boolean) : [], followUpItems: formData.followUpItems ? formData.followUpItems.split(",").map(s => s.trim()).filter(Boolean) : [], questionsAsked: formData.questions.map(q => ({ question: q.question, category: "general", myAnswer: q.answer, rating: q.rating })) };
      if (editingNote) {
        await api.interviewProcess.updateNote(editingNote.id, payload);
        toastSuccess("Notes updated");
      } else {
        await api.interviewProcess.createNote(payload as any);
        toastSuccess("Notes saved");
      }
      setShowForm(false);
      resetForm();
      loadNotes();
    } catch (err: any) {
      setError(err.message || "Failed to save notes");
    }
    setSaving(false);
  }

  function handleEdit(note: any) {
    setEditingNote(note);
    setFormData({
      roundNumber: note.roundNumber,
      type: note.type,
      interviewerName: note.interviewerName,
      scheduledAt: note.scheduledAt.slice(0, 16),
      duration: note.duration,
      overallRating: note.overallRating,
      strengths: note.strengths,
      weaknesses: note.weaknesses,
      questions: note.questions,
      followUpItems: note.followUpItems,
      nextSteps: note.nextSteps,
    });
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete these interview notes?")) return;
    try {
      await api.interviewProcess.deleteNote(id);
      setNotes(prev => prev.filter(n => n.id !== id));
      toastSuccess("Notes deleted");
    } catch (err) {
      reportError(err, { title: "Delete failed", toastError });
    }
  }

  const typeLabels: Record<string, string> = {
    phone: "📞 Phone Screen",
    video: "💻 Video Interview",
    onsite: "🏢 On-site",
    technical: "⚙️ Technical",
    behavioral: "💬 Behavioral",
    case_study: "📊 Case Study",
    panel: "👥 Panel",
    final: "🎯 Final Round",
  };

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Interview Notes" subtitle="Loading your notes..." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Card key={i} className="h-48 animate-pulse bg-gray-100"><div className="h-full" /></Card>)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Interview Notes"
        subtitle="Structured note-taking with questions, answers, and self-ratings"
        action={<Button onClick={() => { resetForm(); setShowForm(true); }}>+ New Notes</Button>}
      />

      {error && <ErrorBanner error={error} />}

      {notes.length === 0 && !loading ? (
        <Card className="text-center py-12">
          <svg className="mx-auto size-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-4 text-gray-500">No interview notes yet. Create your first structured notes!</p>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="mt-4">Create Notes</Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {notes.map(note => {
            const avgRating = note.questions.length > 0
              ? (note.questions.reduce((sum: number, q: any) => sum + (q.rating || 5), 0) / note.questions.length).toFixed(1)
              : "N/A";
            return (
              <Card key={note.id} hover onClick={() => handleEdit(note)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">📝</span>
                    <div>
                      <p className="font-semibold text-gray-900 truncate">Round {note.roundNumber}</p>
                      <p className="text-sm text-gray-500 truncate">{typeLabels[note.type] || note.type}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                    Rating: {avgRating}/10
                  </span>
                </div>

                <p className="text-sm text-gray-500 mb-2">
                  {new Date(note.scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  <span className="mx-1">·</span> {note.duration} min
                </p>

                <div className="mb-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    note.overallRating >= 8 ? "bg-green-100 text-green-700" :
                    note.overallRating >= 6 ? "bg-blue-100 text-blue-700" :
                    note.overallRating >= 4 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                  }`}>
                    Overall: {note.overallRating}/10
                  </span>
                </div>

                {note.strengths && (
                  <div className="mb-2 p-2 bg-green-50 rounded-lg">
                    <p className="text-xs font-medium text-green-900 mb-1">Strengths</p>
                    <p className="text-sm text-green-800 line-clamp-2">{note.strengths}</p>
                  </div>
                )}

                {note.weaknesses && (
                  <div className="mb-2 p-2 bg-red-50 rounded-lg">
                    <p className="text-xs font-medium text-red-900 mb-1">Areas to Improve</p>
                    <p className="text-sm text-red-800 line-clamp-2">{note.weaknesses}</p>
                  </div>
                )}

                {note.questions.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-500 mb-1">Questions ({note.questions.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {note.questions.slice(0, 3).map((q: any, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs truncate max-w-[120px] block">
                          Q: {q.question.substring(0, 40)}...
                        </span>
                      ))}
                      {note.questions.length > 3 && <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">+{note.questions.length - 3} more</span>}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-400 flex-1">Interviewer: {note.interviewerName}</span>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(note); }}>Edit</Button>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }}>Delete</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}