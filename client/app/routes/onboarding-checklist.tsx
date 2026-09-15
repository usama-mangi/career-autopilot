import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import { PageShell, PageHeader, Button, Input, Textarea, Card, Modal, ModalFooter, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Onboarding Checklist" },
  { name: "description", content: "Create a structured onboarding checklist with milestones, learning goals, and key stakeholders" },
];

export default function OnboardingChecklist() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [trackers, setTrackers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTracker, setEditingTracker] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  // Deep link support: ?checklist=<id> expands that checklist in place. There
  // is no per-checklist detail route — the checklist lives on this page.
  const [expandedId, setExpandedId] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("checklist"),
  );

  function openChecklist(id: string) {
    setExpandedId(id);
    const next = new URLSearchParams(searchParams);
    next.set("checklist", id);
    setSearchParams(next, { replace: true });
  }

  function closeExpanded() {
    setExpandedId(null);
    const next = new URLSearchParams(searchParams);
    next.delete("checklist");
    setSearchParams(next, { replace: true });
  }

  const [formData, setFormData] = useState({
    companyName: "",
    roleTitle: "",
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
        const data = await  (api.postOnboarding as any).listChecklists();
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
    setGenerating(true);
    setError("");
    try {
      const result = await  (api.postOnboarding as any).createChecklist({
        companyName: formData.companyName,
        roleTitle: formData.roleTitle,
        startDate: formData.startDate || undefined,
      });
      setTrackers((prev) => [result, ...prev]);
      setShowForm(false);
      setFormData({ companyName: "", roleTitle: "", startDate: "" });
      toastSuccess("Checklist created", "Your onboarding checklist is being generated");
    } catch (err) {
      reportError(err, {
        title: "Creation failed",
        toastError,
        setError,
        retry: handleCreate,
      });
    }
    setSaving(false);
    setGenerating(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this onboarding checklist?")) return;
    try {
      await  (api.postOnboarding as any).deleteChecklist(id);
      setTrackers((prev) => prev.filter((t) => t.id !== id));
      toastSuccess("Checklist deleted");
    } catch (err) {
      reportError(err, { title: "Delete failed", toastError });
    }
  }

  function resetForm() {
    setFormData({ companyName: "", roleTitle: "", startDate: "" });
    setEditingTracker(null);
    setError("");
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Onboarding Checklist" subtitle="Loading your checklists..." />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Card key={i} className="h-48 animate-pulse bg-gray-100"><div className="h-full" /></Card>)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Onboarding Checklist"
        subtitle="Create a structured checklist with milestones, learning goals, and key stakeholders"
        action={<Button onClick={() => { resetForm(); setShowForm(true); }}>+ New Checklist</Button>}
      />

      {error && <ErrorBanner error={error} onRetry={handleCreate} />}

      {trackers.length === 0 ? (
        <Card className="text-center py-12">
          <svg className="mx-auto size-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2v2M9 5v2M9 5l7 7" />
          </svg>
          <p className="mt-4 text-gray-500">No onboarding checklists yet. Create your first one to get started!</p>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="mt-4">Create Checklist</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {trackers.map((tracker) => {
            const completedMilestones = tracker.milestones?.filter((m: any) => m.completed).length || 0;
            const totalMilestones = tracker.milestones?.length || 0;
            const progress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

            return (
              <div key={tracker.id}>
                <Card
                  hover
                  onClick={() => (expandedId === tracker.id ? closeExpanded() : openChecklist(tracker.id))}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{tracker.companyName}</h3>
                      <p className="text-sm text-gray-500">{tracker.roleTitle} · Start: {new Date(tracker.startDate).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-500">{progress}%</span>
                    </div>
                  </div>
                </Card>
                {expandedId === tracker.id && (
                  <div className="mt-2 mb-4 p-4 bg-[#FFF8F0] border border-[#E8DDD1] rounded-xl" ref={(el) => { if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" }); }}>
                    {tracker.categories?.length > 0 ? (
                      <div className="space-y-4">
                        {tracker.categories.map((cat: any) => (
                          <div key={cat.id}>
                            <p className="text-sm font-semibold text-gray-900 mb-2">{cat.name}</p>
                            <ul className="space-y-1.5">
                              {(cat.items || []).map((item: any) => (
                                <li key={item.id} className="flex items-start gap-2 text-sm text-gray-700">
                                  <span
                                    aria-hidden="true"
                                    className={`mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                                      item.completed ? "bg-primary-500 border-primary-500 text-white" : "border-gray-300 bg-white text-transparent"
                                    }`}
                                  >✓</span>
                                  <span className={item.completed ? "line-through text-gray-400" : ""}>{item.title}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Checklist is still being generated — check back shortly.</p>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); closeExpanded(); }}
                      className="mt-4 text-sm font-medium text-primary-600 hover:underline"
                    >
                      Hide checklist
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); resetForm(); }}
        title="New Onboarding Checklist"
        size="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {error && <ErrorBanner error={error} />}
          <Input
            label="Company Name"
            placeholder="e.g. Google"
            value={formData.companyName}
            onChange={(e) => setFormData((p) => ({ ...p, companyName: e.target.value }))}
            required
          />
          <Input
            label="Role Title"
            placeholder="e.g. Senior Software Engineer"
            value={formData.roleTitle}
            onChange={(e) => setFormData((p) => ({ ...p, roleTitle: e.target.value }))}
            required
          />
          <Input
            label="Start Date"
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))}
          />
          <ModalFooter
            actions={[
              { label: "Cancel", variant: "secondary", onClick: () => { setShowForm(false); resetForm(); } },
              { label: saving ? "Generating..." : "Generate Checklist", variant: "primary", onClick: handleCreate, loading: saving },
            ]}
          />
        </form>
      </Modal>
    </PageShell>
  );
}