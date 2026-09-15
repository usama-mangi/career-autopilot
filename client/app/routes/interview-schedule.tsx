import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { PageShell, PageHeader, Button, Input, Textarea, Card, Modal, ModalFooter, Select, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";
import { cn } from "~/lib/utils";

export const meta = () => [
  { title: "Career Autopilot | Interview Schedule" },
  { name: "description", content: "Schedule interviews, track status, and manage prep time blocks" },
];

const STATUS_CONFIG = {
  scheduled: { label: "Scheduled", color: "text-primary-600", bgColor: "bg-primary-50" },
  completed: { label: "Completed", color: "text-success", bgColor: "bg-success-light" },
  cancelled: { label: "Cancelled", color: "text-danger", bgColor: "bg-danger-light" },
  rescheduled: { label: "Rescheduled", color: "text-warning", bgColor: "bg-warning-light" },
};

const TYPE_CONFIG = {
  phone: { label: "Phone Screen", color: "bg-info-50 text-info-700" },
  video: { label: "Video Interview", color: "bg-warning-50 text-warning-700" },
  onsite: { label: "On-site", color: "bg-success-50 text-success-700" },
  technical: { label: "Technical", color: "bg-primary-50 text-primary-600" },
  behavioral: { label: "Behavioral", color: "bg-info-50 text-info-700" },
  case_study: { label: "Case Study", color: "bg-warning-50 text-warning-700" },
  panel: { label: "Panel", color: "bg-info-50 text-info-700" },
  final: { label: "Final Round", color: "bg-danger-50 text-danger-700" },
};

export default function InterviewSchedule() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();
  const [searchParams] = useSearchParams();

  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    applicationId: "" as string,
    companyName: "",
    roleTitle: "",
    interviewType: "video",
    type: "video",
    status: "scheduled",
    scheduledAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    duration: 60,
    interviewerNames: "" as string | string[],
    meetingLink: "",
    location: "",
    notes: "",
    prepTimeBlock: 0,
    prepTimeBlocks: [] as { start: string; end: string; topic: string }[],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  useEffect(() => {
    if (!isPending && !isAuthenticated) { navigate("/login"); return; }
    if (isAuthenticated) loadSchedules();
  }, [isAuthenticated, isPending]);

  // Arriving from an application's toolkit ("Schedule an interview") opens the
  // form pre-filled and linked to that application. A ?schedule=<id> deep link
  // opens that interview's edit modal once the list has loaded.
  useEffect(() => {
    const applicationId = searchParams.get("applicationId");
    if (applicationId) {
      setFormData((prev) => ({
        ...prev,
        applicationId,
        companyName: searchParams.get("company") || "",
        roleTitle: searchParams.get("role") || "",
      }));
      setShowForm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSchedules() {
    try {
      const data = await api.interviewPrep.listSchedule();
      setSchedules(data);
      const scheduleId = searchParams.get("schedule");
      const target = scheduleId ? data.find((s: { id: string }) => s.id === scheduleId) : null;
      if (target) handleEdit(target);
    } catch (err) {
      reportError(err, { title: "Failed to load interviews", toastError });
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      applicationId: "",
      companyName: "",
      roleTitle: "",
      interviewType: "video",
      type: "video",
      status: "scheduled",
      scheduledAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
      duration: 60,
      interviewerNames: "",
      meetingLink: "",
      location: "",
      notes: "",
      prepTimeBlock: 0,
      prepTimeBlocks: [] as { start: string; end: string; topic: string }[],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    setEditingSchedule(null);
    setError("");
    setSuccess("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.companyName.trim() || !formData.roleTitle.trim()) return;
    const isEditing = !!editingSchedule;
    const payload = {
      ...formData,
      interviewerNames: typeof formData.interviewerNames === "string"
        ? formData.interviewerNames.split(",").map(s => s.trim()).filter(Boolean)
        : formData.interviewerNames,
    };
    try {
      if (isEditing) {
        await api.interviewPrep.updateSchedule(editingSchedule.id, payload);
        toastSuccess("Schedule updated");
      } else {
        await api.interviewPrep.createSchedule(payload as any);
        toastSuccess("Interview scheduled");
      }
      setShowForm(false);
      resetForm();
      loadSchedules();
    } catch (err: any) {
      setError(err.message || "Failed to save");
    }
  }

  function handleEdit(schedule: any) {
    setEditingSchedule(schedule);
    setFormData({ ...schedule, scheduledAt: schedule.scheduledAt.slice(0, 16) });
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this interview?")) return;
    try {
      await api.interviewPrep.deleteSchedule(id);
      setSchedules(prev => prev.filter(s => s.id !== id));
      toastSuccess("Interview deleted");
    } catch (err) {
      reportError(err, { title: "Delete failed", toastError });
    }
  }

  function addPrepBlock() {
    setFormData(prev => ({
      ...prev,
      prepTimeBlocks: [...prev.prepTimeBlocks, { start: "", end: "", topic: "" }]
    }));
  }

  function removePrepBlock(index: number) {
    setFormData(prev => ({
      ...prev,
      prepTimeBlocks: prev.prepTimeBlocks.filter((_: any, i: number) => i !== index)
    }));
  }

  function updatePrepBlock(index: number, field: string, value: string) {
    setFormData(prev => ({
      ...prev,
      prepTimeBlocks: prev.prepTimeBlocks.map((b: any, i: number) => i === index ? { ...b, [field]: value } : b)
    }));
  }

  const upcoming = schedules
    .filter(s => s.status === "scheduled" && new Date(s.scheduledAt) >= new Date())
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const past = schedules
    .filter(s => s.status !== "scheduled" || new Date(s.scheduledAt) < new Date())
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Interview Schedule" subtitle="Loading your interviews..." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Card key={i} className="h-48 animate-pulse bg-gray-100"><div className="h-full" /></Card>)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Interview Schedule"
        subtitle={`${schedules.length} interview${schedules.length !== 1 ? "s" : ""} scheduled`}
        action={<Button onClick={() => { resetForm(); setShowForm(true); }}>+ Schedule Interview</Button>}
      />

      {error && <ErrorBanner error={error} />}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">{success}</div>}

      {/* Upcoming Interviews */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Interviews</h2>
        {upcoming.length === 0 ? (
          <Card className="text-center py-12">
            <svg className="mx-auto size-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="mt-4 text-gray-500">No upcoming interviews scheduled.</p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {upcoming.map(schedule => {
              const typeConfig = TYPE_CONFIG[schedule.interviewType as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.video;
              const statusConfig = STATUS_CONFIG[schedule.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.scheduled;
              return (
                <Card key={schedule.id} className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", typeConfig.color)}>{typeConfig.label}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900">{schedule.companyName}</h3>
                        <p className="text-sm text-gray-500">{schedule.roleTitle}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-2">
                    <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    {new Date(schedule.scheduledAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </p>
                  {schedule.applicationId && (
                    <p className="text-xs mb-2">
                      <Link
                        to={`/applications/${schedule.applicationId}`}
                        className="text-primary-600 hover:underline"
                      >
                        ↩ Linked to application
                      </Link>
                    </p>
                  )}
                  <p className="text-sm text-gray-600 mb-2">
                    <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {schedule.location || (schedule.meetingLink ? "Virtual" : "TBD")}
                  </p>

                  {schedule.interviewerNames && (
                    <p className="text-sm text-gray-600 mb-2">
                      <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 10a8 8 0 11-16 0 8 8 0 0116 0zM14 15a4 4 0 01-8 0H3a2 2 0 110-4h1a4 4 0 018 0v4.5a2.5 2.5 0 005 0V15z" /></svg>
                      {schedule.interviewerNames}
                    </p>
                  )}

                  {schedule.prepTimeBlocks?.length > 0 && (
                    <div className="mb-3 p-2 bg-blue-50 rounded-lg">
                      <p className="text-xs font-medium text-blue-900 mb-1">Prep Blocks:</p>
                      <ul className="text-xs text-blue-800 space-y-0.5">
                        {schedule.prepTimeBlocks.map((block: any, i: number) => (
                          <li key={i} className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            {block.start}–{block.end}: {block.topic}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(schedule)} className="flex-1">Edit</Button>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 flex-1" onClick={() => handleDelete(schedule.id)}>Delete</Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        </section>
        {/* Past Interviews */}
        {past.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Past Interviews</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {past.map(schedule => {
                const typeConfig = TYPE_CONFIG[schedule.interviewType as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.video;
                const statusConfig = STATUS_CONFIG[schedule.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.scheduled;
                return (
                  <Card key={schedule.id} className="opacity-70">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={cn("inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full", typeConfig.color)}>{typeConfig.label}</span>
                        <div>
                          <h3 className="font-semibold text-gray-900">{schedule.companyName}</h3>
                          <p className="text-sm text-gray-500">{schedule.roleTitle}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">
                      {new Date(schedule.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    {schedule.applicationId && (
                      <p className="text-xs mb-2">
                        <Link to={`/applications/${schedule.applicationId}`} className="text-primary-600 hover:underline">↩ Linked to application</Link>
                      </p>
                    )}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      {schedule.status === "completed" && (
                        <Link
                          to={`/interview-notes?schedule=${schedule.id}`}
                          className="flex-1 text-center text-sm font-medium text-primary-600 hover:underline"
                        >
                          Log Notes
                        </Link>
                      )}
                      <Button variant="ghost" size="sm" className="flex-1" onClick={() => handleEdit(schedule)}>Edit</Button>
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 flex-1" onClick={() => handleDelete(schedule.id)}>Delete</Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

      {/* Schedule Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); resetForm(); }}
        title={editingSchedule ? "Edit Interview" : "Schedule Interview"}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorBanner error={error} className="mb-0" />}
          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Interview Type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value, interviewType: e.target.value })}
              options={Object.entries(TYPE_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
            />
            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              options={[
                { value: "scheduled", label: "Scheduled" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
                { value: "rescheduled", label: "Rescheduled" },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date & Time"
              type="datetime-local"
              value={formData.scheduledAt}
              onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
              required
            />
            <Input
              label="Duration (minutes)"
              type="number"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
              required
            />
          </div>

          <Input
            label="Interviewer Names"
            placeholder="e.g. Sarah Chen, Mike Johnson"
            value={formData.interviewerNames}
            onChange={(e) => setFormData({ ...formData, interviewerNames: e.target.value })}
          />
          <Input
            label="Meeting Link"
            placeholder="https://zoom.us/... or teams.microsoft.com/..."
            value={formData.meetingLink}
            onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
          />
          <Input
            label="Location (if in-person)"
            placeholder="e.g. 1600 Amphitheatre Parkway, Mountain View, CA"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Prep Time Blocks</label>
            {formData.prepTimeBlocks.map((block, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <Input
                  label="Start"
                  type="datetime-local"
                  value={block.start}
                  onChange={(e) => updatePrepBlock(index, "start", e.target.value)}
                  className="flex-1"
                />
                <Input
                  label="End"
                  type="datetime-local"
                  value={block.end}
                  onChange={(e) => updatePrepBlock(index, "end", e.target.value)}
                  className="flex-1"
                />
                <Input
                  label="Topic"
                  placeholder="e.g. System Design Review"
                  value={block.topic}
                  onChange={(e) => updatePrepBlock(index, "topic", e.target.value)}
                  className="flex-1"
                />
                {formData.prepTimeBlocks.length > 1 && (
                  <button type="button" onClick={() => removePrepBlock(index)} className="mt-8 p-1 text-red-500 hover:text-red-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addPrepBlock}>+ Add Prep Block</Button>
          </div>

          <Textarea
            label="Notes"
            placeholder="Any additional notes, questions to ask, etc."
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />

          <ModalFooter
            actions={[
              { label: "Cancel", variant: "secondary", onClick: () => { setShowForm(false); resetForm(); } },
              { label: editingSchedule ? "Update" : "Schedule", variant: "primary", onClick: handleSubmit },
            ]}
          />
        </form>
      </Modal>
    </PageShell>
  );
}