import { Link, useNavigate } from "react-router";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { useToastHelpers } from "~/components/ui";
import { Skeleton } from "~/components/Skeleton";
import { PageShell, PageHeader, Button, Input, Textarea, Select, Card, Modal, ModalFooter } from "~/components/ui";
import StageLanes from "~/components/StageLanes";
import type { ApplicationStatus } from "types";
import { APPLICATION_STATUS_CONFIG, PIPELINE_STATUSES, formatDate, getNextStatuses } from "~/lib/status-config";
import { ErrorBanner, reportError } from "~/components/ui";

export default function Applications() {
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;

  const [pipeline, setPipeline] = useState<Array<{ id: string; companyName: string; roleTitle: string; status: string; appliedAt?: string; nextActionAt?: string; company?: { name: string } }>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"stages" | "list">("stages");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [formData, setFormData] = useState({ companyName: "", roleTitle: "", notes: "" });

  // Undo state
  const [undoStack, setUndoStack] = useState<Array<{ appId: string; oldStatus: string; newStatus: string }>>([]);

  useEffect(() => {
    if (!isPending && !isAuthenticated) { navigate("/login"); return; }
    if (isAuthenticated) loadPipeline();
  }, [isAuthenticated, isPending, navigate]);

  async function loadPipeline() {
    try {
      setLoading(true);
      const data = await api.applications.pipeline();
      setPipeline(data);
    } catch (err) {
      reportError(err, { title: "Failed to load pipeline", toastError, setError, retry: loadPipeline });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!formData.companyName.trim() || !formData.roleTitle.trim()) return;
    try {
      await api.applications.create({
        companyName: formData.companyName.trim(),
        roleTitle: formData.roleTitle.trim(),
        notes: formData.notes.trim() || undefined,
      });
      setFormData({ companyName: "", roleTitle: "", notes: "" });
      setShowForm(false);
      toastSuccess("Application created", "It starts in the Draft stage — tailor your resume before submitting.");
      loadPipeline();
    } catch (err) {
      reportError(err, { title: "Failed to create", toastError, setError });
    }
  }

  // Optimistic status change with undo
  async function handleStatusChange(appId: string, newStatus: string) {
    const app = pipeline.find(a => a.id === appId);
    if (!app || app.status === newStatus) return;

    const oldStatus = app.status;

    // Optimistic update
    setPipeline(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));

    try {
      await api.applications.updateStatus(appId, { status: newStatus as ApplicationStatus });

      // Push to undo stack
      setUndoStack(prev => [...prev, { appId, oldStatus, newStatus }]);

      // Show undo toast
      toastSuccess(
        `Moved to ${APPLICATION_STATUS_CONFIG[newStatus as ApplicationStatus]?.label || newStatus}`,
        "Undo available for 5 seconds",
        {
          action: {
            label: "Undo",
            onClick: () => handleUndo(appId, oldStatus, newStatus),
          },
        }
      );

      // Auto-clear undo after 5 seconds
      setTimeout(() => {
        setUndoStack(prev => prev.filter(u => !(u.appId === appId && u.oldStatus === oldStatus)));
      }, 5000);
    } catch (err) {
      // Rollback on error
      setPipeline(prev => prev.map(a => a.id === appId ? { ...a, status: oldStatus } : a));
      reportError(err, { title: "Failed to update", toastError, setError });
    }
  }

  // Undo a status change
  async function handleUndo(appId: string, oldStatus: string, newStatus: string) {
    // Optimistic rollback
    setPipeline(prev => prev.map(a => a.id === appId ? { ...a, status: oldStatus } : a));

    try {
      await api.applications.updateStatus(appId, { status: oldStatus as ApplicationStatus });
      setUndoStack(prev => prev.filter(u => !(u.appId === appId && u.oldStatus === oldStatus)));
      toastSuccess("Reverted", `Moved back to ${APPLICATION_STATUS_CONFIG[oldStatus as ApplicationStatus]?.label || oldStatus}`);
    } catch (err) {
      // Rollback again on error
      setPipeline(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
      reportError(err, { title: "Failed to undo", toastError, setError });
    }
  }

  // Filter applications
  const allApps = pipeline;
  const filteredApps = allApps.filter((app) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!app.companyName.toLowerCase().includes(q) && !app.roleTitle.toLowerCase().includes(q)) return false;
    }
    if (filterStatus && app.status !== filterStatus) return false;
    return true;
  });

  const activeApps = filteredApps.filter((a) => !["rejected", "accepted", "withdrawn"].includes(a.status));
  const closedApps = filteredApps.filter((a) => ["rejected", "accepted", "withdrawn"].includes(a.status));

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Applications" subtitle="Loading your pipeline..." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Applications"
        subtitle={`${activeApps.length} active · ${closedApps.length} closed`}
        action={
          <Button onClick={() => setShowForm(true)}>+ Add Job</Button>
        }
      />

      {error && <ErrorBanner error={error} onRetry={loadPipeline} />}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex bg-[#F5EDE4] rounded-lg p-0.5 border border-[#E8DDD1]">
          <Button variant={view === "stages" ? "primary" : "ghost"} size="sm" onClick={() => setView("stages")}>Stages</Button>
          <Button variant={view === "list" ? "primary" : "ghost"} size="sm" onClick={() => setView("list")}>List</Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Input placeholder="Search company or role..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="max-w-xs" />
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} options={[
            { value: "", label: "All Stages" },
            ...PIPELINE_STATUSES.map((s) => ({ value: s, label: APPLICATION_STATUS_CONFIG[s].label })),
          ]} className="w-48" />
        </div>
      </div>

      {/* Stage lanes — the pipeline as a journey, not a board */}
      {view === "stages" ? (
        <StageLanes apps={activeApps} closedApps={closedApps} />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-[#FFF8F0] border-b border-[#E8DDD1]">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-600">Company</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-600">Role</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-600">Stage</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-600">Applied</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-600">Next</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DDD1]">
              {filteredApps.map((app) => {
                const cfg = APPLICATION_STATUS_CONFIG[app.status as ApplicationStatus] || APPLICATION_STATUS_CONFIG.draft;
                return (
                  <tr key={app.id} className="hover:bg-[#FFFBF5] cursor-pointer" onClick={() => navigate(`/applications/${app.id}`)}>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{app.companyName}</td>
                    <td className="px-4 py-2.5 text-gray-600">{app.roleTitle}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded-full ${cfg.bgColor} ${cfg.color} border ${cfg.borderColor}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{formatDate(app.appliedAt)}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{formatDate(app.nextActionAt ?? null)}</td>
                  </tr>
                );
              })}
              {filteredApps.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-sm text-gray-400">No jobs found</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {/* Empty state */}
      {allApps.length === 0 && !loading && (
        <Card className="mt-6 p-8 text-center">
          <p className="text-sm font-medium text-gray-900 mb-1">No jobs tracked yet</p>
          <p className="text-sm text-gray-500 mb-4">
            Every job you're considering lives here — from the moment you start tailoring your resume to the moment you decide.
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => setShowForm(true)}>+ Add a Job Manually</Button>
            <Link to="/jobs">
              <Button variant="outline">Find Jobs</Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setFormData({ companyName: "", roleTitle: "", notes: "" }); setError(""); }}
        title="Track a New Job"
        size="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
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
            label="Notes"
            placeholder="Optional notes about this job..."
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
          {error && <ErrorBanner error={error} className="mb-0" />}
          <ModalFooter
            actions={[
              { label: "Cancel", variant: "secondary", onClick: () => { setShowForm(false); setFormData({ companyName: "", roleTitle: "", notes: "" }); } },
              { label: "Create", variant: "primary", onClick: handleCreate },
            ]}
          />
        </form>
      </Modal>
    </PageShell>
  );
}
