import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { PageShell, PageHeader, Button, Input, Textarea, Card, Modal, ModalFooter, Select, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Interview Cheat Sheet" },
  { name: "description", content: "One-page interview prep: talking points, questions to ask, salary range, red flags" },
];

export default function InterviewCheatSheet() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [sheets, setSheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSheet, setEditingSheet] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [generating, setGenerating] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  // Deep link support: ?sheet=<id> opens that sheet expanded in place. There is
  // no per-sheet detail route — the sheet content renders on this page.
  const [expandedId, setExpandedId] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("sheet"),
  );

  function openSheet(id: string) {
    setExpandedId(id);
    const next = new URLSearchParams(searchParams);
    next.set("sheet", id);
    setSearchParams(next, { replace: true });
  }

  function closeExpanded() {
    setExpandedId(null);
    const next = new URLSearchParams(searchParams);
    next.delete("sheet");
    setSearchParams(next, { replace: true });
  }

  const [formData, setFormData] = useState({
    companyName: "",
    roleTitle: "",
    jobDescription: "",
    resumeText: "",
  });

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadSheets();
  }, [isAuthenticated]);

  async function loadSheets() {
      try {
        const data = await (api.interviewPrep as any).listCheatSheets();
        setSheets(data);
      } catch (err) {
        console.error("Failed to load sheets:", err);
      } finally {
        setLoading(false);
      }
    }

    function resetForm() {
      setFormData({ companyName: "", roleTitle: "", jobDescription: "", resumeText: "" });
      setEditingSheet(null);
      setError("");
      setSuccess("");
    }

    async function handleGenerate() {
      if (!formData.companyName.trim() || !formData.roleTitle.trim()) return;
      setGenerating(true);
      setError("");
      try {
        const result = await  (api.interviewPrep as any).generateCheatSheet(formData);
        setSheets(prev => [result, ...prev]);
        toastSuccess("Cheat sheet generated", "Your interview prep is ready");
        setShowForm(false);
        resetForm();
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
      if (!confirm("Delete this cheat sheet?")) return;
      try {
        await  (api.interviewPrep as any).deleteCheatSheet(id);
        setSheets(prev => prev.filter(s => s.id !== id));
        toastSuccess("Deleted");
      } catch (err) {
        reportError(err, { title: "Delete failed", toastError });
      }
    }

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Interview Cheat Sheet" subtitle="Loading..." />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Card key={i} className="h-48 animate-pulse bg-gray-100"><div className="h-full" /></Card>)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Interview Cheat Sheet Generator"
        subtitle="One-page prep: talking points, questions to ask, salary range, red flags"
        action={<Button onClick={() => { resetForm(); setShowForm(true); }}>+ New Cheat Sheet</Button>}
      />

      {error && <ErrorBanner error={error} onRetry={handleGenerate} />}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">{success}</div>}

      {sheets.length === 0 ? (
        <Card className="text-center py-12">
          <svg className="mx-auto size-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-4 text-gray-500">No cheat sheets yet. Create your first interview prep sheet!</p>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="mt-4">Create Cheat Sheet</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sheets.map(sheet => (
            <Card key={sheet.id} hover className="relative">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{sheet.companyName} — {sheet.roleTitle}</h3>
                  <p className="text-sm text-gray-500 truncate">Generated {new Date(sheet.createdAt).toLocaleDateString()}</p>
                </div>
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(sheet.id)}>Delete</Button>
              </div>

              <div className="prose prose-sm max-w-none text-gray-700 mb-4">
                {sheet.content.split("\n\n").map((para: string, i: number) => (
                  <p key={i}>{para}</p>
                ))}
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => (expandedId === sheet.id ? closeExpanded() : openSheet(sheet.id))}
                  className="flex-1 text-center text-sm font-medium text-primary-600 hover:underline"
                >
                  {expandedId === sheet.id ? "Hide" : "View Full"}
                </button>
                <Button variant="ghost" size="sm" onClick={() => openSheet(sheet.id)}>Open</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Expanded sheet — rendered in place; shareable via ?sheet=<id> */}
      {expandedId &&
        (() => {
          const sheet = sheets.find((s) => s.id === expandedId);
          if (!sheet) return null;
          return (
            <section className="mt-8" aria-label={`${sheet.companyName} cheat sheet`}
              ref={(el) => { if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{sheet.companyName} — {sheet.roleTitle}</h2>
                  <p className="text-sm text-gray-500">Generated {new Date(sheet.createdAt).toLocaleDateString()}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={closeExpanded}>Close</Button>
              </div>
              <Card>
                <div className="prose prose-sm max-w-none text-gray-700">
                  {sheet.content.split("\n\n").map((para: string, i: number) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </Card>
            </section>
          );
        })()}

      {/* Create Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); resetForm(); }}
        title="New Interview Cheat Sheet"
        size="xl"
      >
        <form onSubmit={handleGenerate} className="space-y-4">
          {error && <ErrorBanner error={error} />}
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
          <Textarea
            label="Job Description"
            placeholder="Paste the job description here..."
            rows={4}
            value={formData.jobDescription}
            onChange={(e) => setFormData({ ...formData, jobDescription: e.target.value })}
          />
          <Textarea
            label="Your Resume Text (optional)"
            placeholder="Paste your resume text for tailored insights..."
            rows={3}
            value={formData.resumeText}
            onChange={(e) => setFormData({ ...formData, resumeText: e.target.value })}
          />
          <ModalFooter
            actions={[
              { label: "Cancel", variant: "secondary", onClick: () => { setShowForm(false); resetForm(); } },
              { label: generating ? "Generating..." : "Generate Cheat Sheet", variant: "primary", onClick: handleGenerate, loading: generating },
            ]}
          />
        </form>
      </Modal>
    </PageShell>
  );
}