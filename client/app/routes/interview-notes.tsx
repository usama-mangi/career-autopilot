import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { PageShell, PageHeader, Button, Input, Textarea, Card, Modal, ModalFooter, Select, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";
import type { InterviewNote, InterviewQA, FollowUpEmail, FollowUpEmailGenerateRequest } from "types";

export const meta = () => [
  { title: "Career Autopilot | Interview Notes" },
  { name: "description", content: "Structured interview notes with questions, answers, and ratings" },
];

const TYPE_OPTIONS = [
  { value: "phone_screen", label: "📞 Phone Screen" },
  { value: "technical", label: "⚙️ Technical" },
  { value: "behavioral", label: "💬 Behavioral" },
  { value: "panel", label: "👥 Panel" },
  { value: "onsite", label: "🏢 On-site" },
  { value: "virtual", label: "💻 Virtual" },
  { value: "other", label: "Other" },
];

const EMAIL_TYPE_OPTIONS = [
  { value: "thank_you", label: "🙏 Thank You" },
  { value: "check_in", label: "👋 Check-in" },
  { value: "additional_materials", label: "📎 Additional Materials" },
  { value: "custom", label: "✉️ Custom" },
];

import { suggestFollowUp } from "~/lib/follow-up";

/** Schedule type values (legacy or schedule-specific) → note type values. */
function noteTypeFor(scheduleType: string): string {
  const valid = new Set(TYPE_OPTIONS.map((t) => t.value));
  if (valid.has(scheduleType)) return scheduleType;
  switch (scheduleType) {
    case "phone": return "phone_screen";
    case "video": return "virtual";
    case "case_study": return "other";
    case "final": return "onsite";
    default: return "other";
  }
}


function typeLabel(value: string) {
  return TYPE_OPTIONS.find((t) => t.value === value)?.label ?? value;
}

export default function InterviewNotes() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();
  const [searchParams] = useSearchParams();

  const [notes, setNotes] = useState<InterviewNote[]>([]);
  const [emails, setEmails] = useState<FollowUpEmail[]>([]);
  const [emailsLoaded, setEmailsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<InterviewNote | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Follow-up email drafting from a note's follow-up items: generate with the
  // AI, review, then save — persisted via the same followUpEmails endpoint as
  // the Follow-up Emails page, linked to the note and its application.
  const [draftFor, setDraftFor] = useState<{ note: InterviewNote; item: string; timing: string } | null>(null);
  const [genForm, setGenForm] = useState<{
    type: FollowUpEmailGenerateRequest["type"];
    additionalContext: string;
    applicationId: string;
  }>({ type: "thank_you", additionalContext: "", applicationId: "" });
  const [draftEmail, setDraftEmail] = useState<{ subject: string; body: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [genError, setGenError] = useState("");
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    applicationId: "",
    scheduleId: "",
    companyName: "",
    roleTitle: "",
    interviewType: "virtual",
    interviewDate: new Date().toISOString().slice(0, 16),
    roundNumber: 1,
    selfRating: 5,
    strengths: "",
    weaknesses: "",
    questions: [] as { question: string; myAnswer: string; rating: number }[],
    followUpItems: "",
    generalNotes: "",
  });

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated) loadNotes();
  }, [isAuthenticated]);

  // Arriving from an application's toolkit ("Log interview notes") opens the
  // form pre-filled and linked to that application. Arriving from a completed
  // interview in the schedule ("Log Notes") prefills company/role/type/date
  // from that schedule, carries its scheduleId and applicationId onto the
  // created note, and bumps the round number past any notes already logged for
  // that job. A ?note=<id> deep link opens that note for editing instead.
  useEffect(() => {
    const applicationId = searchParams.get("applicationId");
    const scheduleId = searchParams.get("schedule");
    const noteId = searchParams.get("note");
    const emailId = searchParams.get("email");
    if (applicationId) {
      setFormData((prev) => ({
        ...prev,
        applicationId,
        companyName: searchParams.get("company") || "",
        roleTitle: searchParams.get("role") || "",
      }));
      setShowForm(true);
    } else if (scheduleId) {
      Promise.all([
        api.interviewPrep.getScheduleEntry(scheduleId),
        api.interviewProcess.listNotes(),
      ])
        .then(([schedule, existingNotes]) => {
          const sameJob = existingNotes.filter(
            (n) => n.companyName === schedule.companyName && n.roleTitle === schedule.roleTitle,
          );
          setFormData((prev) => ({
            ...prev,
            scheduleId,
            applicationId: schedule.applicationId || "",
            companyName: schedule.companyName,
            roleTitle: schedule.roleTitle,
            interviewType: noteTypeFor(schedule.interviewType),
            interviewDate: new Date(schedule.scheduledAt).toISOString().slice(0, 16),
            roundNumber: sameJob.reduce((max, n) => Math.max(max, n.roundNumber), 0) + 1,
          }));
          setShowForm(true);
        })
        .catch((err) => reportError(err, { title: "Failed to load interview", toastError }));    } else if (noteId && !emailId) {
      // With an ?email target we skip the note-edit modal: the job there is
      // reviewing and sending the email, not editing the note.
      api.interviewProcess.getNote(noteId)
        .then((note) => {
          setEditingNote(note);
          setFormData({
            applicationId: note.applicationId || "",
            scheduleId: note.scheduleId || "",
            companyName: note.companyName,
            roleTitle: note.roleTitle,
            interviewType: note.interviewType,
            interviewDate: new Date(note.interviewDate).toISOString().slice(0, 16),
            roundNumber: note.roundNumber,
            selfRating: note.selfRating,
            strengths: note.strengths.join(", "),
            weaknesses: note.weaknesses.join(", "),
            questions: (note.questionsAsked || []).map((q) => ({ question: q.question, myAnswer: q.myAnswer || "", rating: q.rating || 5 })),
            followUpItems: note.followUpItems.join(", "),
            generalNotes: note.generalNotes || "",
          });
          setShowForm(true);
        })
        .catch((err) => reportError(err, { title: "Failed to load note", toastError }));
    }
    // A ?email=<id> deep link (e.g. from the Today dashboard's follow-up
    // nudge) expands that saved email's preview in place, ready to copy
    // or mark sent. Independent of the prefill branches above.
    if (emailId) {
      api.interviewProcess.getFollowUpEmail(emailId)
        .then((email) => setExpandedEmailId(email.id))
        .catch((err) => reportError(err, { title: "Failed to load email", toastError }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadNotes() {
    try {
      const [noteData, emailData] = await Promise.all([
        api.interviewProcess.listNotes(),
        api.interviewProcess.listFollowUpEmails().catch(() => [] as FollowUpEmail[]),
      ]);
      setNotes(noteData);
      setEmails(emailData);
      setEmailsLoaded(true);
    } catch (err) {
      console.error("Failed to load notes:", err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      applicationId: "",
      scheduleId: "",
      companyName: "",
      roleTitle: "",
      interviewType: "virtual",
      interviewDate: new Date().toISOString().slice(0, 16),
      roundNumber: 1,
      selfRating: 5,
      strengths: "",
      weaknesses: "",
      questions: [],
      followUpItems: "",
      generalNotes: "",
    });
    setEditingNote(null);
    setError("");
  }

  function addQuestion() {
    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions, { question: "", myAnswer: "", rating: 5 }]
    }));
  }

  function removeQuestion(index: number) {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }));
  }

  function updateQuestion(index: number, field: "question" | "myAnswer" | "rating", value: string | number) {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => i === index ? { ...q, [field]: value } : q)
    }));
  }

  function splitList(value: string): string[] {
    return value.split(",").map(s => s.trim()).filter(Boolean);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.companyName.trim() || !formData.roleTitle.trim()) return;
    setSaving(true);
    setError("");
    const questionsAsked: InterviewQA[] = formData.questions
      .filter(q => q.question.trim())
      .map(q => ({ question: q.question.trim(), category: "general", myAnswer: q.myAnswer.trim() || undefined, rating: q.rating }));
    const payload = {
      applicationId: formData.applicationId || undefined,
      scheduleId: formData.scheduleId || undefined,
      companyName: formData.companyName.trim(),
      roleTitle: formData.roleTitle.trim(),
      interviewType: formData.interviewType,
      interviewDate: new Date(formData.interviewDate).toISOString(),
      roundNumber: formData.roundNumber,
      selfRating: formData.selfRating,
      strengths: splitList(formData.strengths),
      weaknesses: splitList(formData.weaknesses),
      followUpItems: splitList(formData.followUpItems),
      generalNotes: formData.generalNotes.trim() || undefined,
      questionsAsked,
    };
    try {
      if (editingNote) {
        await api.interviewProcess.updateNote(editingNote.id, {
          questionsAsked,
          selfRating: payload.selfRating,
          strengths: payload.strengths,
          weaknesses: payload.weaknesses,
          followUpItems: payload.followUpItems,
          generalNotes: payload.generalNotes,
        });
        toastSuccess("Notes updated");
      } else {
        await api.interviewProcess.createNote(payload);
        toastSuccess("Notes saved");
      }
      setShowForm(false);
      resetForm();
      loadNotes();
    } catch (err) {
      reportError(err, { title: editingNote ? "Update failed" : "Save failed", toastError, setError });
    }
    setSaving(false);
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

  function openDraftEmail(note: InterviewNote, item: string) {
    setGenError("");
    setDraftEmail(null);
    // Type and timing are suggested from the interview date and what has
    // already been drafted/sent — not a hardcoded default.
    const suggestion = suggestFollowUp(note, item, emails);
    setGenForm({
      type: suggestion.type,
      applicationId: note.applicationId || "",
      // Seed the AI context with the follow-up item itself plus the strengths
      // from the note, so the draft references what actually went well.
      additionalContext: [item, note.strengths.length > 0 ? `Went well: ${note.strengths.join("; ")}` : ""]
        .filter(Boolean)
        .join(". "),
    });
    setDraftFor({ note, item, timing: suggestion.timing });
  }

  async function handleGenerateDraft(e?: React.FormEvent) {
    e?.preventDefault();
    if (!draftFor) return;
    setGenerating(true);
    setGenError("");
    try {
      const result = await api.interviewProcess.generateFollowUpEmail({
        type: genForm.type,
        roleTitle: draftFor.note.roleTitle,
        companyName: draftFor.note.companyName,
        additionalContext: genForm.additionalContext || undefined,
      });
      setDraftEmail({ subject: result.subject, body: result.body });
    } catch (err) {
      reportError(err, { title: "Generation failed", toastError, setError: setGenError, retry: handleGenerateDraft });
    }
    setGenerating(false);
  }

  async function handleSaveDraft(e?: React.FormEvent) {
    e?.preventDefault();
    if (!draftFor || !draftEmail) return;
    setSavingEmail(true);
    try {
      const email = await api.interviewProcess.createFollowUpEmail({
        interviewNoteId: draftFor.note.id,
        applicationId: genForm.applicationId || undefined,
        type: genForm.type,
        subject: draftEmail.subject.trim(),
        body: draftEmail.body.trim(),
      });
      setEmails(prev => [email, ...prev]);
      toastSuccess("Follow-up email saved", "Review, copy, and send it — then mark it sent");
      setDraftFor(null);
      setDraftEmail(null);
    } catch (err) {
      reportError(err, { title: "Save failed", toastError, setError: setGenError, retry: handleSaveDraft });
    }
    setSavingEmail(false);
  }

  async function markEmailSent(id: string) {
    if (!confirm("Mark this email as sent?")) return;
    try {
      const updated = await api.interviewProcess.updateFollowUpEmail(id, { sentAt: new Date().toISOString() });
      setEmails(prev => prev.map(e => (e.id === id ? updated : e)));
      toastSuccess("Marked as sent");
    } catch (err) {
      reportError(err, { title: "Update failed", toastError });
    }
  }

  async function copyEmail(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopiedEmailId(id);
    setTimeout(() => setCopiedEmailId(null), 2000);
  }

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
        <div className="grid gap-4 md:grid-cols-2">
          {notes.map(note => {
            const rated = (note.questionsAsked || []).filter(q => typeof q.rating === "number");
            const avgRating = rated.length > 0
              ? (rated.reduce((sum, q) => sum + (q.rating || 0), 0) / rated.length).toFixed(1)
              : null;
            return (
              <Card key={note.id} hover className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{note.companyName} — {note.roleTitle}</p>
                    <p className="text-sm text-gray-500">
                      {typeLabel(note.interviewType)} · Round {note.roundNumber} ·{" "}
                      {new Date(note.interviewDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    note.selfRating >= 4 ? "bg-green-100 text-green-700" :
                    note.selfRating >= 3 ? "bg-blue-100 text-blue-700" :
                    note.selfRating >= 2 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                  }`}>
                    Self: {note.selfRating}/5
                  </span>
                </div>

                {note.applicationId && (
                  <a href={`/applications/${note.applicationId}`} className="text-xs text-primary-600 hover:underline">
                    ↩ From application
                  </a>
                )}

                {note.strengths.length > 0 && (
                  <div className="p-2 bg-green-50 rounded-lg">
                    <p className="text-xs font-medium text-green-900 mb-0.5">Strengths</p>
                    <p className="text-sm text-green-800 line-clamp-2">{note.strengths.join(", ")}</p>
                  </div>
                )}

                {note.weaknesses.length > 0 && (
                  <div className="p-2 bg-red-50 rounded-lg">
                    <p className="text-xs font-medium text-red-900 mb-0.5">Areas to Improve</p>
                    <p className="text-sm text-red-800 line-clamp-2">{note.weaknesses.join(", ")}</p>
                  </div>
                )}

                {(note.questionsAsked || []).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">
                      Questions ({note.questionsAsked.length}){avgRating && ` · avg ${avgRating}/10`}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {note.questionsAsked.slice(0, 3).map((q, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs truncate max-w-[160px] block">
                          Q: {q.question}
                        </span>
                      ))}
                      {note.questionsAsked.length > 3 && <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">+{note.questionsAsked.length - 3} more</span>}
                    </div>
                  </div>
                )}

                {/* Follow-ups: each item drafts an email; saved emails preview inline */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Follow-ups</p>
                  {note.followUpItems.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {note.followUpItems.map((item, i) => (
                        <button
                          key={i}
                          onClick={() => openDraftEmail(note, item)}
                          className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs hover:bg-amber-100 transition"
                          title="Generate a follow-up email for this item"
                        >
                          ✉️ {item}
                        </button>
                      ))}
                    </div>
                  )}
                  {emails.filter(e => e.interviewNoteId === note.id).length > 0 ? (
                    <div className="space-y-1">
                      {emails.filter(e => e.interviewNoteId === note.id).map((email) => (
                        <div key={email.id} className="border border-gray-200 rounded-lg p-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setExpandedEmailId(expandedEmailId === email.id ? null : email.id)}
                              className="text-xs font-medium text-gray-700 truncate flex-1 text-left hover:text-primary-600 transition"
                            >
                              {email.subject}
                            </button>
                            {email.sentAt ? (
                              <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 rounded-full px-1.5 py-0.5 whitespace-nowrap">sent</span>
                            ) : (
                              <>
                                <button onClick={() => copyEmail(email.body, email.id)} className="text-[10px] text-gray-500 hover:text-primary-600 transition whitespace-nowrap">
                                  {copiedEmailId === email.id ? "copied!" : "copy"}
                                </button>
                                <button onClick={() => markEmailSent(email.id)} className="text-[10px] text-gray-500 hover:text-green-600 transition whitespace-nowrap">
                                  mark sent
                                </button>
                              </>
                            )}
                          </div>
                          {expandedEmailId === email.id && (
                            <pre className="mt-2 text-[11px] text-gray-600 whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">{email.body}</pre>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <button
                      onClick={() => openDraftEmail(note, note.followUpItems[0] || "this interview")}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      ✉️ Generate follow-up email
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <span className="flex-1" />
                  <Button variant="ghost" size="sm" onClick={() => { setEditingNote(note); setFormData({
                    applicationId: note.applicationId || "",
                    scheduleId: note.scheduleId || "",
                    companyName: note.companyName,
                    roleTitle: note.roleTitle,
                    interviewType: note.interviewType,
                    interviewDate: new Date(note.interviewDate).toISOString().slice(0, 16),
                    roundNumber: note.roundNumber,
                    selfRating: note.selfRating,
                    strengths: note.strengths.join(", "),
                    weaknesses: note.weaknesses.join(", "),
                    questions: (note.questionsAsked || []).map(q => ({ question: q.question, myAnswer: q.myAnswer || "", rating: q.rating || 5 })),
                    followUpItems: note.followUpItems.join(", "),
                    generalNotes: note.generalNotes || "",
                  }); setShowForm(true); }}>Edit</Button>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(note.id)}>Delete</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); resetForm(); }}
        title={editingNote ? "Edit Interview Notes" : "New Interview Notes"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorBanner error={error} />}
          {formData.applicationId && (
            <div className="p-3 bg-primary-50 border border-primary-100 rounded-lg text-sm text-primary-700">
              Linked to this application — notes will appear on its toolkit.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Company Name"
              placeholder="e.g. Google"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              required
            />
            <Input
              label="Role Title"
              placeholder="e.g. Senior Software Engineer"
              value={formData.roleTitle}
              onChange={(e) => setFormData({ ...formData, roleTitle: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Interview Type"
              value={formData.interviewType}
              onChange={(e) => setFormData({ ...formData, interviewType: e.target.value })}
              options={TYPE_OPTIONS}
            />
            <Input
              label="Round Number"
              type="number"
              min={1}
              value={formData.roundNumber}
              onChange={(e) => setFormData({ ...formData, roundNumber: parseInt(e.target.value, 10) || 1 })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Interview Date"
              type="datetime-local"
              value={formData.interviewDate}
              onChange={(e) => setFormData({ ...formData, interviewDate: e.target.value })}
            />
            <Select
              label="Self Rating (1–5)"
              value={String(formData.selfRating)}
              onChange={(e) => setFormData({ ...formData, selfRating: parseInt(e.target.value, 10) || 5 })}
              options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}` }))}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Questions & Answers</label>
              <Button type="button" variant="outline" size="sm" onClick={addQuestion}>+ Add Question</Button>
            </div>
            {formData.questions.length === 0 && (
              <p className="text-xs text-gray-400">No questions captured yet.</p>
            )}
            <div className="space-y-3">
              {formData.questions.map((q, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <Input
                    placeholder="Question asked"
                    value={q.question}
                    onChange={(e) => updateQuestion(i, "question", e.target.value)}
                  />
                  <Textarea
                    placeholder="Your answer"
                    rows={2}
                    value={q.myAnswer}
                    onChange={(e) => updateQuestion(i, "myAnswer", e.target.value)}
                  />
                  <div className="flex items-center gap-3">
                    <Select
                      label="Rating (1–10)"
                      value={String(q.rating)}
                      onChange={(e) => updateQuestion(i, "rating", parseInt(e.target.value, 10) || 5)}
                      options={Array.from({ length: 10 }, (_, n) => ({ value: String(n + 1), label: `${n + 1}` }))}
                    />
                    <Button type="button" variant="ghost" size="sm" className="text-red-500 mt-4" onClick={() => removeQuestion(i)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Input
            label="Strengths (comma-separated)"
            placeholder="Clear communication, strong system design"
            value={formData.strengths}
            onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
          />
          <Input
            label="Weaknesses (comma-separated)"
            placeholder="Need sharper STAR examples"
            value={formData.weaknesses}
            onChange={(e) => setFormData({ ...formData, weaknesses: e.target.value })}
          />
          <Input
            label="Follow-up Items (comma-separated)"
            placeholder="Send thank-you email, share portfolio"
            value={formData.followUpItems}
            onChange={(e) => setFormData({ ...formData, followUpItems: e.target.value })}
          />
          <Textarea
            label="General Notes"
            rows={3}
            value={formData.generalNotes}
            onChange={(e) => setFormData({ ...formData, generalNotes: e.target.value })}
          />
          <ModalFooter
            actions={[
              { label: "Cancel", variant: "secondary", onClick: () => { setShowForm(false); resetForm(); } },
              { label: saving ? "Saving..." : editingNote ? "Save Changes" : "Save Notes", variant: "primary", onClick: handleSubmit, loading: saving },
            ]}
          />
        </form>
      </Modal>

      {/* Follow-up email draft modal: generate → review → save, linked to the note */}
      <Modal
        isOpen={draftFor !== null}
        onClose={() => { setDraftFor(null); setDraftEmail(null); }}
        title="Generate Follow-up Email"
        size="lg"
      >
        {draftFor && (
          <div className="space-y-4">
            {genError && <ErrorBanner error={genError} onRetry={handleGenerateDraft} />}
            <p className="text-sm text-gray-600">
              For <span className="font-medium text-gray-900">{draftFor.note.companyName} — {draftFor.note.roleTitle}</span> · Round {draftFor.note.roundNumber}
            </p>
            <p className="text-xs text-gray-500 -mt-2">
              Item: <span className="italic">{draftFor.item}</span>
            </p>
            {!draftEmail ? (
              <form onSubmit={handleGenerateDraft} className="space-y-4">
                <Select
                  label="Email Type (suggested)"
                  value={genForm.type}
                  onChange={(e) => setGenForm({ ...genForm, type: e.target.value as FollowUpEmailGenerateRequest["type"] })}
                  options={EMAIL_TYPE_OPTIONS}
                />
                <p className="text-xs text-primary-700 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2 -mt-1">
                  ⏱ {draftFor.timing}
                </p>
                <Textarea
                  label="Context for the AI (edit freely)"
                  rows={4}
                  value={genForm.additionalContext}
                  onChange={(e) => setGenForm({ ...genForm, additionalContext: e.target.value })}
                />
                <ModalFooter
                  actions={[
                    { label: "Cancel", variant: "secondary", onClick: () => { setDraftFor(null); setDraftEmail(null); } },
                    { label: generating ? "Generating..." : "Generate Draft", variant: "primary", onClick: handleGenerateDraft, loading: generating },
                  ]}
                />
              </form>
            ) : (
              <form onSubmit={handleSaveDraft} className="space-y-4">
                <Input
                  label="Subject"
                  value={draftEmail.subject}
                  onChange={(e) => setDraftEmail({ ...draftEmail, subject: e.target.value })}
                  required
                />
                <Textarea
                  label="Body"
                  rows={10}
                  value={draftEmail.body}
                  onChange={(e) => setDraftEmail({ ...draftEmail, body: e.target.value })}
                  required
                />
                <p className="text-xs text-gray-400">
                  Saved to your follow-up emails{genForm.applicationId ? " and linked to this application" : ""}.
                </p>
                <ModalFooter
                  actions={[
                    { label: "Back", variant: "secondary", onClick: () => setDraftEmail(null) },
                    { label: savingEmail ? "Saving..." : "Save Email", variant: "primary", onClick: handleSaveDraft, loading: savingEmail },
                  ]}
                />
              </form>
            )}
          </div>
        )}
      </Modal>
    </PageShell>
  );
}
