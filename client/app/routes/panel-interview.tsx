import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import { PageShell, PageHeader, Button, Input, Textarea, Card, Modal, ModalFooter, Select, useToastHelpers, ScoreBadge, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Panel Interview Coordinator" },
  { name: "description", content: "Manage multi-interviewer schedules, collect feedback, and consolidate panel interview results" },
];

const statusConfig: Record<string, { label: string; class: string }> = {
  scheduled: { label: "Scheduled", class: "bg-blue-100 text-blue-700" },
  completed: { label: "Completed", class: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelled", class: "bg-red-100 text-red-700" },
};

interface InterviewerInput {
  name: string;
  role: string;
  email: string;
}

export default function PanelInterview() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [panels, setPanels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    companyName: "",
    roleTitle: "",
    scheduledAt: "",
    duration: 60,
    location: "",
    meetingLink: "",
    notes: "",
  });
  const [interviewers, setInterviewers] = useState<InterviewerInput[]>([
    { name: "", role: "", email: "" },
  ]);

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadPanels();
  }, [isAuthenticated]);

  async function loadPanels() {
    setLoading(true);
    try {
      const data = await api.interviewProcess.listPanelInterviews();
      setPanels(data);
    } catch (err) {
      console.error("Failed to load panels:", err);
    }
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.companyName || !formData.roleTitle || !formData.scheduledAt) return;
    const validInterviewers = interviewers.filter((i) => i.name.trim());
    if (validInterviewers.length === 0) { setError("Add at least one interviewer"); return; }
    setSaving(true);
    setError("");
    try {
      const panel = await api.interviewProcess.createPanelInterview({
        companyName: formData.companyName,
        roleTitle: formData.roleTitle,
        scheduledAt: new Date(formData.scheduledAt).toISOString(),
        duration: formData.duration,
        location: formData.location || undefined,
        meetingLink: formData.meetingLink || undefined,
        interviewers: validInterviewers.map((i) => ({ name: i.name.trim(), role: i.role.trim() || undefined, email: i.email.trim() || undefined })),
        notes: formData.notes || undefined,
      });
      setPanels((prev) => [panel, ...prev]);
      setShowForm(false);
      resetForm();
      toastSuccess("Panel scheduled", "Interview panel created successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create panel interview");
    }
    setSaving(false);
  }

  async function handleStatusChange(id: string, status: "scheduled" | "completed" | "cancelled") {
    try {
      const updated = await api.interviewProcess.updatePanelInterview(id, { status });
      setPanels((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this panel interview?")) return;
    try {
      await api.interviewProcess.deletePanelInterview(id);
      setPanels((prev) => prev.filter((p) => p.id !== id));
      toastSuccess("Deleted");
    } catch (err) {
      reportError(err, { title: "Delete failed", toastError });
    }
  }

  function resetForm() {
    setFormData({ companyName: "", roleTitle: "", scheduledAt: "", duration: 60, location: "", meetingLink: "", notes: "" });
    setInterviewers([{ name: "", role: "", email: "" }]);
  }

  function addInterviewer() {
    setInterviewers((prev) => [...prev, { name: "", role: "", email: "" }]);
  }

  function removeInterviewer(idx: number) {
    setInterviewers((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateInterviewer(idx: number, field: keyof InterviewerInput, value: string) {
    setInterviewers((prev) => prev.map((int, i) => (i === idx ? { ...int, [field]: value } : int)));
  }

  const filtered = filter === "all" ? panels : panels.filter((p) => p.status === filter);

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Panel Interview Coordinator"
        subtitle="Manage multi-interviewer schedules and consolidated feedback"
        action={<Button onClick={() => { resetForm(); setShowForm(true); }}>+ Schedule Panel</Button>}
      />

      {error && <ErrorBanner error={error} />}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { value: "all", label: "All" },
          ...Object.entries(statusConfig).map(([k, v]) => ({ value: k, label: v.label })),
        ].map((t) => (
          <Button
            key={t.value}
            variant={filter === t.value ? "primary" : "ghost"}
            size="sm"
            onClick={() => setFilter(t.value)}
            className="flex items-center gap-1"
          >
            {t.label}
          </Button>
        ))}
      </div>

      {/* Panel List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-500">No panel interviews scheduled yet.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((panel) => {
            const status = statusConfig[panel.status] || statusConfig.scheduled;
            const interviewersList = (panel.interviewers as any[]) || [];
            return (
              <Card key={panel.id} className="relative">
                <div className="p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpandedId(expandedId === panel.id ? null : panel.id)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-gray-900">{panel.companyName} \u2014 {panel.roleTitle}</h3>
                        <span className={cn("text-xs font-medium px-2 py-1 rounded-full", status.class)}>{status.label}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(panel.scheduledAt).toLocaleString()} \u00b7 {panel.duration} min \u00b7 {interviewersList.length} interviewer{interviewersList.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {panel.status === "scheduled" && (
                        <>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleStatusChange(panel.id, "completed"); }}>Complete</Button>
                          <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleStatusChange(panel.id, "cancelled"); }}>Cancel</Button>
                        </>
                      )}
                      <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDelete(panel.id); }}>Delete</Button>
                    </div>
                  </div>
                </div>

                {expandedId === panel.id && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Interviewers</h4>
                        <div className="space-y-2">
                          {interviewersList.map((int: any, i: number) => (
                            <div key={i} className="bg-white rounded-lg p-3 border border-gray-200">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-info-50 text-info-700 flex items-center justify-center text-sm font-bold">
                                  {int.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">{int.name}</p>
                                  {int.role && <p className="text-xs text-gray-500">{int.role}</p>}
                                </div>
                              </div>
                              {int.email && <p className="text-xs text-gray-400 mt-1 ml-10">{int.email}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">Details</h4>
                        <dl className="space-y-1 text-sm">
                          {panel.location && <div><dt className="text-gray-500">Location:</dt><dd className="text-gray-900">{panel.location}</dd></div>}
                          {panel.meetingLink && <div><dt className="text-gray-500">Meeting Link:</dt><dd className="text-primary-600"><a href={panel.meetingLink} target="_blank" rel="noopener noreferrer" className="hover:underline">{panel.meetingLink}</a></dd></div>}
                          {panel.notes && <div><dt className="text-gray-500">Notes:</dt><dd className="text-gray-900 whitespace-pre-wrap">{panel.notes}</dd></div>}
                        </dl>
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
        title="Schedule Panel Interview"
        size="xl"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Scheduled At"
              type="datetime-local"
              value={formData.scheduledAt}
              onChange={(e) => setFormData((p) => ({ ...p, scheduledAt: e.target.value }))}
              required
            />
            <Input
              label="Duration (minutes)"
              type="number"
              min="15"
              value={formData.duration}
              onChange={(e) => setFormData((p) => ({ ...p, duration: parseInt(e.target.value) || 60 }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Location"
              placeholder="e.g., Conference Room A"
              value={formData.location}
              onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
            />
            <Input
              label="Meeting Link"
              placeholder="https://..."
              type="url"
              value={formData.meetingLink}
              onChange={(e) => setFormData((p) => ({ ...p, meetingLink: e.target.value }))}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Interviewers *</label>
              <Button type="button" variant="ghost" size="sm" onClick={addInterviewer}>+ Add Interviewer</Button>
            </div>
            <div className="space-y-2">
              {interviewers.map((int, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <Input
                    placeholder="Name *"
                    required
                    value={int.name}
                    onChange={(e) => updateInterviewer(idx, "name", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Role"
                    value={int.role}
                    onChange={(e) => updateInterviewer(idx, "role", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={int.email}
                    onChange={(e) => updateInterviewer(idx, "email", e.target.value)}
                    className="flex-1"
                  />
                  {interviewers.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-700 p-1 mt-8" onClick={() => removeInterviewer(idx)}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Textarea
            label="Notes"
            placeholder="Any additional notes..."
            rows={2}
            value={formData.notes}
            onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
          />

          <ModalFooter
            actions={[
              { label: "Cancel", variant: "secondary", onClick: () => { setShowForm(false); resetForm(); } },
              { label: saving ? "Scheduling..." : "Schedule Panel", variant: "primary", onClick: handleCreate, loading: saving },
            ]}
          />
        </form>
      </Modal>
    </PageShell>
  );
}