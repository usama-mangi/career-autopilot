import type { CaseStudy } from "types";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { PageShell, PageHeader, Button, Input, Textarea, Card, Modal, ModalFooter, Select, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Case Study Builder" },
  { name: "description", content: "Build presentation-ready case studies with AI assistance for interview rounds" },
];

export default function CaseStudyComponent() {
  const { id } = useParams();
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [studies, setStudies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStudy, setEditingStudy] = useState<any | null>(null);
  const [viewingStudy, setViewingStudy] = useState<any | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    company: "",
    role: "",
    problem: "",
    approach: "",
    solution: "",
    results: "",
    technologies: "",
    metrics: "",
    challenges: "",
    learnings: "",
  });

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadStudies();
  }, [isAuthenticated]);

  async function loadStudies() {
    try {
      const data = await api.caseStudy.list();
      setStudies(data);
    } catch (err) {
      console.error("Failed to load studies:", err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      title: "",
      company: "",
      role: "",
      problem: "",
      approach: "",
      solution: "",
      results: "",
      technologies: "",
      metrics: "",
      challenges: "",
      learnings: "",
    });
    setEditingStudy(null);
    setError("");
    setSuccess("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title.trim() || !formData.company.trim() || !formData.role.trim()) return;
    const isEditing = !!editingStudy;
    setGenerating(true);
    setError("");
    try {
      const payload = { title: formData.title, companyName: formData.company, roleTitle: formData.role, description: [formData.problem, formData.approach, formData.solution, formData.results, formData.technologies, formData.metrics, formData.challenges, formData.learnings].filter(Boolean).join("\n\n") };
      if (isEditing) {
        await api.caseStudy.update(editingStudy.id, payload);
        toastSuccess("Case study updated");
      } else {
        await api.caseStudy.create(payload as any);
        toastSuccess("Case study created");
      }
      setShowForm(false);
      resetForm();
      loadStudies();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
    setGenerating(false);
  }

  function handleEdit(study: any) {
    setEditingStudy(study);
    setFormData({
      title: study.title,
      company: study.companyName || "",
      role: study.roleTitle || "",
      problem: study.description || "",
      approach: "",
      solution: "",
      results: "",
      technologies: (study.slides || []).map((s: any) => s.title).join(", ") || "",
      metrics: "",
      challenges: "",
      learnings: "",
    });
    setShowForm(true);
  }

  async function handleView(study: CaseStudy) {
    setViewingStudy(study);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this case study?")) return;
    try {
      await api.caseStudy.delete(id);
      setStudies(prev => prev.filter(s => s.id !== id));
      toastSuccess("Case study deleted");
    } catch (err) {
      reportError(err, { title: "Delete failed", toastError });
    }
  }

  async function handleGenerate() {
    if (!editingStudy) return;
    setGenerating(true);
    try {
      const result = await api.caseStudy.generateAI(editingStudy.id as any);
      setEditingStudy(result);
      toastSuccess("Content generated", "AI has enhanced your case study");
    } catch (err) {
      reportError(err, {
        title: "Generation failed",
        toastError,
        retry: handleGenerate,
      });
    }
    setGenerating(false);
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Case Study Builder" subtitle="Loading..." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Card key={i} className="h-48 animate-pulse bg-gray-100"><div className="h-full" /></Card>)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Case Study Builder"
        subtitle="Build presentation-ready case studies with AI assistance for interview rounds"
        action={<Button onClick={() => { resetForm(); setShowForm(true); }}>+ New Case Study</Button>}
      />

      {error && <ErrorBanner error={error} onRetry={handleGenerate} />}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">{success}</div>}

      {studies.length === 0 && !viewingStudy ? (
        <Card className="text-center py-12">
          <svg className="mx-auto size-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2h6a2 2 0 002-2M5 11V5a2 2 0 012-2h6a2 2 0 012 2v2" />
          </svg>
          <p className="mt-4 text-gray-500">No case studies yet. Create your first case study for interview presentations!</p>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="mt-4">Create Case Study</Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {studies.map(study => (
            <Card key={study.id} hover onClick={() => handleView(study)}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{study.title}</h3>
                  <p className="text-sm text-gray-500 truncate">{study.company} — {study.role}</p>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-3 line-clamp-3">{study.problem}</p>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {study.technologies?.slice(0, 4).map((t: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded text-xs font-medium">{t}</span>
                ))}
                {study.technologies?.length > 4 && <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">+{study.technologies.length - 4} more</span>}
              </div>

              {study.results && (
                <p className="text-sm text-green-700 mb-2">
                  <span className="font-medium">Key Result:</span> {study.results}
                </p>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-400">Updated {formatDate(study.updatedAt)}</span>
                <div className="flex-1"></div>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleView(study); }}>View</Button>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(study); }}>Edit</Button>
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={(e) => { e.stopPropagation(); handleDelete(study.id); }}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* View Modal */}
      <Modal isOpen={!!viewingStudy} onClose={() => setViewingStudy(null)} title="Case Study Details" size="xl">
        {viewingStudy && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{viewingStudy.title}</h3>
                <p className="text-gray-600 mt-1">{viewingStudy.company} — {viewingStudy.role}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => { setViewingStudy(null); handleEdit(viewingStudy); }}>Edit</Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Problem</h4>
                <p className="text-gray-700 whitespace-pre-wrap">{viewingStudy.problem}</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Approach</h4>
                <p className="text-gray-700 whitespace-pre-wrap">{viewingStudy.approach}</p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Solution</h4>
              <p className="text-gray-700 whitespace-pre-wrap">{viewingStudy.solution}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Results & Metrics</h4>
                <p className="text-gray-700 whitespace-pre-wrap">{viewingStudy.results}</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Technologies</h4>
                <div className="flex flex-wrap gap-1.5">
                  {viewingStudy.technologies?.map((t: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded text-xs font-medium">{t}</span>
                  ))}
                </div>
              </div>
            </div>

            {viewingStudy.challenges && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Challenges Overcome</h4>
                <p className="text-gray-700 whitespace-pre-wrap">{viewingStudy.challenges}</p>
              </div>
            )}

            {viewingStudy.learnings && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Key Learnings</h4>
                <p className="text-gray-700 whitespace-pre-wrap">{viewingStudy.learnings}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Create/Edit Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingStudy ? "Edit Case Study" : "New Case Study"} size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorBanner error={error} />}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Title *" placeholder="e.g. E-commerce Platform Redesign" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
            <Input label="Company *" placeholder="e.g. Google" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} required />
          </div>
          <Input label="Role *" placeholder="e.g. Senior Product Manager" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} required />
          <Textarea label="Problem Statement *" placeholder="What was the business challenge?" rows={3} value={formData.problem} onChange={e => setFormData({...formData, problem: e.target.value})} required />
          <Textarea label="Approach" placeholder="How did you approach the problem?" rows={3} value={formData.approach} onChange={e => setFormData({...formData, approach: e.target.value})} />
          <Textarea label="Solution" placeholder="What solution did you implement?" rows={3} value={formData.solution} onChange={e => setFormData({...formData, solution: e.target.value})} />
          <Textarea label="Results & Metrics" placeholder="Quantifiable outcomes (e.g. increased revenue by 20%, reduced latency by 40%)" rows={3} value={formData.results} onChange={e => setFormData({...formData, results: e.target.value})} />
          <Input label="Technologies (comma-separated)" placeholder="React, Node.js, PostgreSQL, AWS" value={formData.technologies} onChange={e => setFormData({...formData, technologies: e.target.value})} />
          <Input label="Key Metrics (comma-separated)" placeholder="Revenue +$2M, Users 500k, Latency -40%" value={formData.metrics} onChange={e => setFormData({...formData, metrics: e.target.value})} />
          <Textarea label="Challenges Overcome" placeholder="Technical or organizational challenges you solved" rows={3} value={formData.challenges} onChange={e => setFormData({...formData, challenges: e.target.value})} />
          <Textarea label="Key Learnings" placeholder="What did you learn from this experience?" rows={3} value={formData.learnings} onChange={e => setFormData({...formData, learnings: e.target.value})} />
          <ModalFooter actions={[
            { label: "Cancel", variant: "secondary", onClick: () => { setShowForm(false); resetForm(); } },
            { label: generating ? "Generating..." : (editingStudy ? "Update" : "Create"), variant: "primary", onClick: handleSubmit, loading: generating },
          ]} />
        </form>
      </Modal>
    </PageShell>
  );
}
