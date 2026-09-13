import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import { PageShell, PageHeader, Button, Input, Textarea, Card, Modal, ModalFooter, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | 30-60-90 Day Plan Builder" },
  { name: "description", content: "Create a structured 30-60-90 day plan for your new role" },
];

function getPhaseColor(phase: string) {
  switch (phase) {
    case "30": return "bg-blue-100 text-blue-700";
    case "60": return "bg-purple-100 text-purple-700";
    case "90": return "bg-green-100 text-green-700";
    default: return "bg-gray-100 text-gray-700";
  }
}

function getImpactColor(impact: string) {
  switch (impact) {
    case "high": return "bg-red-100 text-red-700";
    case "medium": return "bg-yellow-100 text-yellow-700";
    case "low": return "bg-green-100 text-green-700";
    default: return "bg-gray-100 text-gray-700";
  }
}

export default function First90Days() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [trackers, setTrackers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [formData, setFormData] = useState({
    companyName: "",
    roleTitle: "",
    jobDescription: "",
    startDate: "",
  });

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadTrackers();
  }, [isAuthenticated]);

  async function loadTrackers() {
    setLoading(true);
    try {
      const data = await api.postOnboarding.listTrackers();
      setTrackers(data);
    } catch (err) {
      console.error("Failed to load trackers:", err);
    }
    setLoading(false);
  }

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!formData.companyName || !formData.roleTitle) return;
    setSaving(true);
    setError("");
    try {
      const result = await api.postOnboarding.createTracker({
        companyName: formData.companyName,
        roleTitle: formData.roleTitle,
        startDate: formData.startDate || new Date().toISOString(),
      });
      setTrackers(prev => [result, ...prev]);
      setShowForm(false);
      setFormData({ companyName: "", roleTitle: "", jobDescription: "", startDate: "" });
      toastSuccess("Plan created", "Your 90-day plan has been generated");
    } catch (err) {
      reportError(err, {
        title: "Creation failed",
        toastError,
        setError,
        retry: handleCreate,
      });
    }
    setSaving(false);
  }

  async function handleUpdateTracker(id: string, updates: any) {
    setUpdating(true);
    try {
      const updated = await  (api.postOnboarding as any).updateTracker(id, updates);
      setTrackers(prev => prev.map(t => t.id === id ? updated : t));
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      reportError(err, { title: "Update failed", toastError });
    }
    setUpdating(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this 90-day plan?")) return;
    try {
      await  (api.postOnboarding as any).deleteTracker(id);
      setTrackers(prev => prev.filter(t => t.id !== id));
      if (expandedId === id) setExpandedId(null);
      toastSuccess("Plan deleted");
    } catch (err) {
      reportError(err, { title: "Delete failed", toastError });
    }
  }

  function resetForm() {
    setFormData({ companyName: "", roleTitle: "", jobDescription: "", startDate: "" });
    setError("");
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="30-60-90 Day Plan Builder" subtitle="Loading your plans..." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Card key={i} className="h-64 animate-pulse bg-gray-100"><div className="h-full" /></Card>)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="30-60-90 Day Plan Builder"
        subtitle="Create a structured ramp-up plan with milestones, learning goals, and key stakeholders"
        action={<Button onClick={() => { resetForm(); setShowForm(true); }}>+ New Plan</Button>}
      />

      {error && <ErrorBanner error={error} onRetry={handleCreate} />}

      {trackers.length === 0 ? (
        <Card className="text-center py-12">
          <svg className="mx-auto size-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2v2M9 5v2M9 5l7 7" />
          </svg>
          <p className="mt-4 text-gray-500">No 90-day plans yet. Create your first plan to get started!</p>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="mt-4">Create Plan</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {trackers.map(tracker => {
            const currentPhase = tracker.phases?.find((p: any) => p.isCurrent) || tracker.phases?.[0];
            const overallProgress = tracker.phases?.reduce((sum: number, p: any) => sum + (p.progress || 0), 0) / (tracker.phases?.length || 1) || 0;

            return (
              <Card key={tracker.id} hover onClick={() => setExpandedId(expandedId === tracker.id ? null : tracker.id)}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{tracker.companyName} — {tracker.roleTitle}</h3>
                    <p className="text-sm text-gray-500">Start: {new Date(tracker.startDate).toLocaleDateString()} · Overall: {Math.round(overallProgress)}% complete</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className={cn("text-xs", getPhaseColor(currentPhase?.phase || "30"))} onClick={(e) => { e.stopPropagation(); }}>
                      {currentPhase?.phase || 30} Days
                    </Button>
                  </div>
                </div>

                {expandedId === tracker.id && (
                  <div className="border-t border-gray-100 pt-6 mt-4 space-y-6">
                    {/* Phase Tabs */}
                    <div className="flex gap-2 border-b border-gray-200">
                      {["30", "60", "90"].map(phaseNum => {
                        const phase = tracker.phases?.find((p: any) => p.phase === phaseNum);
                        if (!phase) return null;
                        return (
                          <Button
                            key={phaseNum}
                            variant={currentPhase?.phase === phaseNum ? "primary" : "ghost"}
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleUpdateTracker(tracker.id, { ...tracker, phases: tracker.phases.map((p: any) => p.phase === phaseNum ? { ...p, isCurrent: true } : { ...p, isCurrent: false }) }); }}
                          >
                            {phaseNum} Days
                          </Button>
                        );
                      })}
                    </div>

                    {/* Milestones */}
                    {currentPhase?.milestones?.length > 0 && (
                                          <div>
                                            <h4 className="font-semibold text-gray-900 mb-3">Milestones</h4>
                                            <div className="space-y-2">
                                              {currentPhase.milestones.map((m: any, i: number) => (
                                                <div key={m.id || i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                                  <input
                                                    type="checkbox"
                                                    checked={m.completed}
                                                    onChange={(e) => handleUpdateTracker(tracker.id, { ...tracker, phases: tracker.phases.map((p: any) => p.phase === currentPhase.phase ? { ...p, milestones: p.milestones.map((mm: any) => mm.id === m.id ? { ...mm, completed: e.target.checked } : mm) } : p) })}
                                                    className="mt-1 size-4 text-primary-500 border-gray-300 rounded"
                                                  />
                                                  <div className="flex-1">
                                                    <p className={cn("font-medium text-gray-900", m.completed && "line-through text-gray-400")}>{m.title}</p>
                                                    {m.description && <p className="text-sm text-gray-600 mt-0.5">{m.description}</p>}
                                                    <div className="flex items-center gap-2 mt-1">
                                                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", getImpactColor(m.impact))}>{m.impact}</span>
                                                      <span className="text-xs text-gray-500">Owner: {m.owner}</span>
                                                    </div>
                                                  </div>
                                                  <Button variant="ghost" size="sm" className="text-red-500" onClick={(e) => { e.stopPropagation(); handleUpdateTracker(tracker.id, { ...tracker, phases: tracker.phases.map((p: any) => p.phase === currentPhase.phase ? { ...p, milestones: p.milestones.filter((mm: any) => mm.id !== m.id) } : p) }); }}>Delete</Button>
                                                </div>
                                              ))}
                                              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleUpdateTracker(tracker.id, { ...tracker, phases: tracker.phases.map((p: any) => p.phase === currentPhase.phase ? { ...p, milestones: [...p.milestones, { id: Date.now().toString(), title: "", description: "", completed: false, impact: "medium", owner: "You" }] } : p) }); }}>+ Add Milestone</Button>
                                            </div>
                                          </div>
                                        )}

                    {/* Learning Goals */}
                    {currentPhase?.learningGoals?.length > 0 && (
                                          <div>
                                            <h4 className="font-semibold text-gray-900 mb-3">Learning Goals</h4>
                                            <div className="space-y-2">
                                              {currentPhase.learningGoals.map((g: any, i: number) => (
                                                <div key={g.id || i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                                  <input
                                                    type="checkbox"
                                                    checked={g.completed}
                                                    onChange={(e) => handleUpdateTracker(tracker.id, { ...tracker, phases: tracker.phases.map((p: any) => p.phase === currentPhase.phase ? { ...p, learningGoals: p.learningGoals.map((gg: any) => gg.id === g.id ? { ...gg, completed: e.target.checked } : gg) } : p) })}
                                                    className="mt-1 size-4 text-primary-500 border-gray-300 rounded"
                                                  />
                                                  <div className="flex-1">
                                                    <p className={cn("font-medium text-gray-900", g.completed && "line-through text-gray-400")}>{g.topic}</p>
                                                    <p className="text-sm text-gray-600 mt-0.5">{g.resources}</p>
                                                  </div>
                                                  <Button variant="ghost" size="sm" className="text-red-500" onClick={(e) => { e.stopPropagation(); handleUpdateTracker(tracker.id, { ...tracker, phases: tracker.phases.map((p: any) => p.phase === currentPhase.phase ? { ...p, learningGoals: p.learningGoals.filter((gg: any) => gg.id !== g.id) } : p) }); }}>Delete</Button>
                                                </div>
                                              ))}
                                              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleUpdateTracker(tracker.id, { ...tracker, phases: tracker.phases.map((p: any) => p.phase === currentPhase.phase ? { ...p, learningGoals: [...p.learningGoals, { id: Date.now().toString(), topic: "", resources: "", completed: false }] } : p) }); }}>+ Add Learning Goal</Button>
                                            </div>
                                          </div>
                                        )}

                    {/* Key Stakeholders */}
                    {currentPhase?.stakeholders?.length > 0 && (
                                          <div>
                                            <h4 className="font-semibold text-gray-900 mb-3">Key Stakeholders</h4>
                                            <div className="space-y-2">
                                              {currentPhase.stakeholders.map((s: any, i: number) => (
                                                <div key={s.id || i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                                  <div className="size-8 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 font-medium text-sm">{s.name.charAt(0)}</div>
                                                  <div className="flex-1">
                                                    <p className="font-medium text-gray-900">{s.name}</p>
                                                    <p className="text-sm text-gray-500">{s.role} · {s.department}</p>
                                                  </div>
                                                  <Button variant="ghost" size="sm" className="text-red-500" onClick={(e) => { e.stopPropagation(); handleUpdateTracker(tracker.id, { ...tracker, phases: tracker.phases.map((p: any) => p.phase === currentPhase.phase ? { ...p, stakeholders: p.stakeholders.filter((ss: any) => ss.id !== s.id) } : p) }); }}>Remove</Button>
                                                </div>
                                              ))}
                                              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleUpdateTracker(tracker.id, { ...tracker, phases: tracker.phases.map((p: any) => p.phase === currentPhase.phase ? { ...p, stakeholders: [...p.stakeholders, { id: Date.now().toString(), name: "", role: "", department: "" }] } : p) }); }}>+ Add Stakeholder</Button>
                                            </div>
                                          </div>
                                        )}

                    {/* Progress */}
                    <div className="pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">Phase Progress</span>
                        <span className="text-sm text-gray-500">{Math.round(currentPhase.progress || 0)}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-500 rounded-full transition-all duration-500" style={{ width: `${currentPhase.progress || 0}%` }} />
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); resetForm(); }}
        title="New 90-Day Plan"
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
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
          <Input
            label="Start Date"
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
          />
          <Textarea
            label="Job Description (optional)"
            placeholder="Paste the job description for AI-generated milestones..."
            rows={4}
            value={formData.jobDescription}
            onChange={(e) => setFormData({ ...formData, jobDescription: e.target.value })}
          />
          <ModalFooter
            actions={[
              { label: "Cancel", variant: "secondary", onClick: () => { setShowForm(false); resetForm(); } },
              { label: saving ? "Creating..." : "Create Plan", variant: "primary", onClick: handleCreate, loading: saving },
            ]}
          />
        </form>
      </Modal>
    </PageShell>
  );
}