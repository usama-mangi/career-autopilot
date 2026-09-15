import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import { PageShell, PageHeader, Button, Input, Textarea, Card, Modal, ModalFooter, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";
import type { First90DaysTracker } from "types";

export const meta = () => [
  { title: "Career Autopilot | 30-60-90 Day Plan Builder" },
  { name: "description", content: "Create a structured 30-60-90 day plan for your new role" },
];

export default function First90Days() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();
  const [searchParams] = useSearchParams();

  const [trackers, setTrackers] = useState<First90DaysTracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    companyName: "",
    roleTitle: "",
    jobDescription: "",
    startDate: "",
    applicationId: "",
  });

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  // Arriving from an accepted application or offer ("Plan your first 90 days")
  // opens the form pre-filled and linked to that job. Viewing an existing
  // plan goes to its own page (/onboarding/first-90-days/:id).
  useEffect(() => {
    const applicationId = searchParams.get("applicationId");
    if (applicationId) {
      setFormData((prev) => ({
        ...prev,
        applicationId,
        companyName: searchParams.get("company") || "",
        roleTitle: searchParams.get("role") || "",
        startDate: searchParams.get("startDate") || "",
      }));
      setShowForm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        applicationId: formData.applicationId || undefined,
        companyName: formData.companyName,
        roleTitle: formData.roleTitle,
        startDate: formData.startDate || new Date().toISOString(),
      });
      setTrackers(prev => [result, ...prev]);
      setShowForm(false);
      setFormData({ companyName: "", roleTitle: "", jobDescription: "", startDate: "", applicationId: "" });
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

  async function handleDelete(id: string) {
    if (!confirm("Delete this 90-day plan?")) return;
    try {
      await api.postOnboarding.deleteTracker(id);
      setTrackers(prev => prev.filter(t => t.id !== id));
      toastSuccess("Plan deleted");
    } catch (err) {
      reportError(err, { title: "Delete failed", toastError });
    }
  }

  function resetForm() {
    setFormData({ companyName: "", roleTitle: "", jobDescription: "", startDate: "", applicationId: "" });
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
          {trackers.map(tracker => (
            <Card key={tracker.id} hover>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{tracker.companyName} — {tracker.roleTitle}</h3>
                  <p className="text-sm text-gray-500">
                    Start: {new Date(tracker.startDate).toLocaleDateString()} ·{" "}
                    {tracker.currentPhase === "leading" ? "Leading" : tracker.currentPhase === "contributing" ? "Contributing" : "Learning"} phase
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link to={`/onboarding/first-90-days/${tracker.id}`}>
                    <Button variant="outline" size="sm">Open Plan</Button>
                  </Link>
                  <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(tracker.id)}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
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
          {formData.applicationId && (
            <div className="p-3 bg-primary-50 border border-primary-100 rounded-lg text-sm text-primary-700">
              Linked to your accepted application — milestones will be generated for this role.
            </div>
          )}
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