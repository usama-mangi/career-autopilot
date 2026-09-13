import { Link, useNavigate } from "react-router";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { useToastHelpers } from "~/components/ui";
import { Skeleton } from "~/components/Skeleton";
import { PageShell, PageHeader, Button, Input, Textarea, Select, Card, Modal, ModalFooter } from "~/components/ui";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { JobApplication, ApplicationStatus } from "types";
import { APPLICATION_STATUS_CONFIG, PIPELINE_STATUSES, formatDate, getNextStatuses } from "~/lib/status-config";
import { ErrorBanner, reportError } from "~/components/ui";

// Kanban column component
function KanbanColumn({ status, apps, onMoveApp }: { status: string; apps: any[]; onMoveApp: (appId: string, newStatus: string) => void }) {
  const cfg = APPLICATION_STATUS_CONFIG[status as ApplicationStatus];
  const nextStatuses = getNextStatuses(status as ApplicationStatus);

  return (
    <div className="flex-shrink-0 w-72">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-t-xl ${cfg.bgColor} border border-b-0 ${cfg.borderColor}`}>
        <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
        <span className={`text-[10px] font-medium ${cfg.color} opacity-70`}>{apps.length}</span>
      </div>
      <div className={`bg-[#FFF8F0] rounded-b-xl p-2 min-h-[200px] border border-t-0 ${cfg.borderColor}`}>
        <SortableContext items={apps.map(a => a.id)} strategy={verticalListSortingStrategy}>
          {apps.map((app) => (
            <KanbanCard
              key={app.id}
              app={app}
              nextStatuses={nextStatuses}
              onMove={onMoveApp}
            />
          ))}
        </SortableContext>
        {apps.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-gray-400 mb-1">No applications</p>
            <p className="text-[10px] text-gray-400">Drag cards here or add new ones</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Sortable card component
function KanbanCard({ app, nextStatuses, onMove }: { app: any; nextStatuses: string[]; onMove: (appId: string, newStatus: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: app.id, data: { status: app.status } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white rounded-lg p-3 shadow-sm border border-[#E8DDD1] hover:shadow-md transition-all duration-150 mb-2 cursor-grab active:cursor-grabbing group"
      tabIndex={0}
      role="listitem"
      aria-label={`${app.companyName} - ${app.roleTitle}`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" && nextStatuses.length > 0) {
          e.preventDefault();
          onMove(app.id, nextStatuses[0]);
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          // Move to previous status in pipeline
          const currentIdx = PIPELINE_STATUSES.indexOf(app.status);
          if (currentIdx > 0) {
            onMove(app.id, PIPELINE_STATUSES[currentIdx - 1]);
          }
        }
      }}
    >
      <Link to={`/applications/${app.id}`} className="block" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-medium text-gray-900 truncate">{app.companyName}</p>
        <p className="text-xs text-gray-600 truncate">{app.roleTitle}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-gray-500">{formatDate(app.appliedAt || undefined)}</span>
          {nextStatuses.length > 0 && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <select
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.preventDefault();
                  onMove(app.id, e.target.value);
                }}
                className="text-[10px] border border-[#E8DDD1] rounded px-1.5 py-0.5 text-gray-600 bg-[#FFFBF5] hover:bg-[#F5EDE4] transition-colors cursor-pointer"
                value=""
                aria-label="Move to status"
              >
                <option value="" disabled>Move</option>
                {nextStatuses.map((s) => (
                  <option key={s} value={s}>{APPLICATION_STATUS_CONFIG[s as ApplicationStatus].label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}

export default function Applications() {
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;

  const [pipeline, setPipeline] = useState<Array<{ id: string; companyName: string; roleTitle: string; status: string; appliedAt?: string; nextActionAt?: string; company?: { name: string } }>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [formData, setFormData] = useState({ companyName: "", roleTitle: "", notes: "" });
  const [activeId, setActiveId] = useState<string | null>(null);

  // Undo state
  const [undoStack, setUndoStack] = useState<Array<{ appId: string; oldStatus: string; newStatus: string }>>([]);

  // Sensors for drag-drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

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
      toastSuccess("Application created");
      loadPipeline();
    } catch (err) {
      reportError(err, { title: "Failed to create", toastError, setError });
      setTimeout(() => setError(""), 3000);
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
      setError(err instanceof Error ? err.message : "Failed to update");
      setTimeout(() => setError(""), 3000);
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
      setError(err instanceof Error ? err.message : "Failed to undo");
      setTimeout(() => setError(""), 3000);
    }
  }

  // Drag handlers
  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeApp = pipeline.find(a => a.id === activeId);
    if (!activeApp) return;

    // Determine target status
    let targetStatus: string;
    const overApp = pipeline.find(a => a.id === overId);
    if (overApp) {
      targetStatus = overApp.status;
    } else {
      // Over a column
      targetStatus = overId as string;
    }

    // Move card if status changed
    if (activeApp.status !== targetStatus) {
      setPipeline(prev => {
        const activeIndex = prev.findIndex(a => a.id === activeId);
        if (activeIndex === -1) return prev;

        const updated = [...prev];
        updated[activeIndex] = { ...updated[activeIndex], status: targetStatus };
        return updated;
      });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeApp = pipeline.find(a => a.id === activeId);
    if (!activeApp) return;

    // Determine final status
    let finalStatus: string;
    const overApp = pipeline.find(a => a.id === overId);
    if (overApp) {
      finalStatus = overApp.status;
    } else {
      finalStatus = overId as string;
    }

    // Update status if changed
    if (activeApp.status !== finalStatus) {
      handleStatusChange(activeId, finalStatus);
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

  // Group by status for kanban
  const appsByStatus = PIPELINE_STATUSES.reduce((acc, status) => {
    acc[status] = filteredApps.filter(app => app.status === status);
    return acc;
  }, {} as Record<string, typeof filteredApps>);

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Application Tracker" subtitle="Loading your route..." />
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64 w-72 rounded-xl shrink-0" />)}
        </div>
      </PageShell>
    );
  }

  const activeApp = activeId ? pipeline.find(a => a.id === activeId) : null;

  return (
    <PageShell>
      <PageHeader
        title="Application Tracker"
        subtitle={`${allApps.length} application${allApps.length !== 1 ? "s" : ""} on your route`}
        action={
          <Button onClick={() => setShowForm(true)}>+ Add Application</Button>
        }
      />

      {error && <ErrorBanner error={error} onRetry={loadPipeline} />}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex bg-[#F5EDE4] rounded-lg p-0.5 border border-[#E8DDD1]">
          <Button variant={view === "kanban" ? "primary" : "ghost"} size="sm" onClick={() => setView("kanban")}>Board</Button>
          <Button variant={view === "list" ? "primary" : "ghost"} size="sm" onClick={() => setView("list")}>List</Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Input placeholder="Search company or role..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="max-w-xs" />
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} options={[
            { value: "", label: "All Statuses" },
            ...PIPELINE_STATUSES.map((s) => ({ value: s, label: APPLICATION_STATUS_CONFIG[s].label })),
          ]} className="w-48" />
        </div>
      </div>

      {/* Kanban with DnD */}
      {view === "kanban" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-4">
            {PIPELINE_STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                apps={appsByStatus[status]}
                onMoveApp={handleStatusChange}
              />
            ))}
          </div>
          <DragOverlay>
            {activeApp ? (
              <div className="bg-white rounded-lg p-3 shadow-lg border border-primary-200 w-72 rotate-2">
                <p className="text-sm font-medium text-gray-900 truncate">{activeApp.companyName}</p>
                <p className="text-xs text-gray-600 truncate">{activeApp.roleTitle}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-[#FFF8F0] border-b border-[#E8DDD1]">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-600">Company</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-600">Role</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-600">Status</th>
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
                <tr><td colSpan={5} className="text-center py-8 text-sm text-gray-400">No applications found</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setFormData({ companyName: "", roleTitle: "", notes: "" }); setError(""); }}
        title="New Application"
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
            placeholder="Optional notes about this application..."
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

      {/* Keyboard help */}
      <div className="mt-6 p-4 bg-[#FFF8F0] rounded-xl border border-[#E8DDD1]">
        <p className="text-xs font-medium text-gray-600 mb-1">Keyboard shortcuts</p>
        <p className="text-[11px] text-gray-500">
          <kbd className="px-1.5 py-0.5 bg-white rounded border border-[#E8DDD1] text-gray-600 font-mono text-[10px]">Tab</kbd> to focus cards
          <span className="mx-2">·</span>
          <kbd className="px-1.5 py-0.5 bg-white rounded border border-[#E8DDD1] text-gray-600 font-mono text-[10px]">→</kbd> move right
          <span className="mx-2">·</span>
          <kbd className="px-1.5 py-0.5 bg-white rounded border border-[#E8DDD1] text-gray-600 font-mono text-[10px]">←</kbd> move left
          <span className="mx-2">·</span>
          Drag cards between columns
        </p>
      </div>
    </PageShell>
  );
}
