import type { JobApplication, CommunicationLog, ReferralRequest } from "types";
import { Link, useParams, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { ErrorBanner, reportError, useToastHelpers } from "~/components/ui";

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  draft: { label: "Draft", color: "text-gray-600", bgColor: "bg-gray-100" },
  applied: { label: "Applied", color: "text-blue-600", bgColor: "bg-blue-100" },
  phone_screen: { label: "Phone Screen", color: "text-purple-600", bgColor: "bg-purple-100" },
  interviewing: { label: "Interviewing", color: "text-amber-600", bgColor: "bg-amber-100" },
  offer: { label: "Offer", color: "text-green-600", bgColor: "bg-green-100" },
  rejected: { label: "Rejected", color: "text-red-600", bgColor: "bg-red-100" },
  accepted: { label: "Accepted", color: "text-emerald-600", bgColor: "bg-emerald-100" },
  withdrawn: { label: "Withdrawn", color: "text-slate-500", bgColor: "bg-slate-100" },
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["applied", "withdrawn"],
  applied: ["phone_screen", "rejected", "withdrawn"],
  phone_screen: ["interviewing", "rejected", "withdrawn"],
  interviewing: ["offer", "rejected", "withdrawn"],
  offer: ["accepted", "rejected", "withdrawn"],
  rejected: [],
  accepted: [],
  withdrawn: [],
};

const COMM_TYPES = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "message", label: "Message" },
  { value: "in_person", label: "In Person" },
  { value: "video_call", label: "Video Call" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "other", label: "Other" },
];

const REFERRAL_STATUSES = ["not_requested", "requested", "agreed", "declined", "submitted"];

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const { error: toastError } = useToastHelpers();

  const [app, setApp] = useState<JobApplication | null>(null);
  const [comms, setComms] = useState<CommunicationLog[]>([]);
  const [referral, setReferral] = useState<ReferralRequest | null>(null);
  const [resumeName, setResumeName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState<"overview" | "comms" | "referral">("overview");

  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({ companyName: "", roleTitle: "", notes: "", nextSteps: "" });

  const [showCommForm, setShowCommForm] = useState(false);
  const [commForm, setCommForm] = useState({ type: "email", subject: "", content: "", direction: "outbound", outcome: "" });

  const [showRefForm, setShowRefForm] = useState(false);
  const [refForm, setRefForm] = useState({ employeeName: "", employeeEmail: "", relationship: "", status: "requested", notes: "" });

  useEffect(() => {
    if (!isPending && !isAuthenticated) { navigate("/login"); return; }
    if (isAuthenticated && id) loadData();
  }, [isAuthenticated, isPending, id, navigate]);

  async function loadData() {
    try {
      setLoading(true);
      const [appData, commsData, refData] = await Promise.all([
        api.applications.get(id!),
        api.applications.getComms(id!),
        api.applications.getReferral(id!).catch(() => null),
      ]);
      setApp(appData as any);
      setComms(commsData as any);
      setReferral(refData as any);
      setEditData({
        companyName: appData.companyName || "",
        roleTitle: appData.roleTitle || "",
        notes: appData.notes || "",
        nextSteps: appData.nextSteps || "",
      });

      // Load resume name if resumeId is present
      if (appData.resumeId) {
        try {
          const resume = await api.resumes.get(appData.resumeId);
          setResumeName(resume.jobTitle || resume.companyName || resume.fileName || "Resume");
        } catch {
          setResumeName("Resume");
        }
      }
    } catch (err) {
      reportError(err, { title: "Load failed", toastError, setError, retry: loadData });
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
      try {
        await api.applications.updateStatus(id!, { status: newStatus as any });
      setSuccess(`Status changed to ${STATUS_CONFIG[newStatus]?.label}`);
      setTimeout(() => setSuccess(""), 3000);
      loadData();
    } catch (err) {
      reportError(err, { title: "Status change failed", toastError, setError, retry: loadData });
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.applications.update(id!, editData);
      setEditMode(false);
      setSuccess("Application updated");
      setTimeout(() => setSuccess(""), 3000);
      loadData();
    } catch (err) {
      reportError(err, { title: "Update failed", toastError, setError });
    }
  }

  async function handleAddComm(e: React.FormEvent) {
    e.preventDefault();
    if (!commForm.content.trim()) return;
    try {
      await api.applications.addComm(id!, {
        type: commForm.type as any,
        subject: commForm.subject.trim() || undefined,
        content: commForm.content.trim(),
        direction: commForm.direction as any || undefined,
        outcome: commForm.outcome.trim() || undefined,
      } as any);
      setCommForm({ type: "email", subject: "", content: "", direction: "outbound", outcome: "" });
      setShowCommForm(false);
      setSuccess("Communication logged");
      setTimeout(() => setSuccess(""), 3000);
      loadData();
    } catch (err) {
      reportError(err, { title: "Log failed", toastError, setError });
    }
  }

  async function handleReferral(e: React.FormEvent) {
    e.preventDefault();
    if (!refForm.employeeName.trim()) return;
    try {
      await api.applications.upsertReferral(id!, {
        employeeName: refForm.employeeName.trim(),
        employeeEmail: refForm.employeeEmail.trim() || undefined,
        relationship: refForm.relationship.trim() || undefined,
        status: refForm.status as any,
        notes: refForm.notes.trim() || undefined,
      } as any);
      setShowRefForm(false);
      setSuccess("Referral updated");
      setTimeout(() => setSuccess(""), 3000);
      loadData();
    } catch (err) {
      reportError(err, { title: "Referral failed", toastError, setError });
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this application?")) return;
    try {
      await api.applications.delete(id!);
      navigate("/applications");
    } catch (err) {
      reportError(err, { title: "Delete failed", toastError, setError, retry: loadData });
    }
  }

  function formatDate(d: string | null | undefined) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function formatDateTime(d: string | null | undefined) {
    if (!d) return "—";
    return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }


  if (loading || !app) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-8 animate-pulse">
          <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.draft;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link to="/applications" className="text-sm text-blue-600 hover:text-blue-800 mb-4 inline-flex items-center gap-1">
          ← Back to Applications
        </Link>

        {error && <ErrorBanner error={error} onRetry={loadData} />}
        {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{success}</div>}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{app.companyName}</h1>
                <p className="text-gray-500 mt-0.5">{app.roleTitle}</p>
                <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
                  <span>Created {formatDate(app.createdAt)}</span>
                  {app.appliedAt && <span>Applied {formatDate(app.appliedAt)}</span>}
                  {app.job?.source && <span>via {app.job.source}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${cfg.bgColor} ${cfg.color}`}>
                  {cfg.label}
                </span>
                <button onClick={handleDelete} className="text-gray-400 hover:text-red-500 p-1" title="Delete">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
              </div>
            </div>

            {STATUS_TRANSITIONS[app.status].length > 0 && (
              <div className="flex gap-2 mt-4">
                {STATUS_TRANSITIONS[app.status].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition hover:opacity-80 ${
                      s === "accepted" ? "bg-green-50 text-green-700 border-green-200" :
                      s === "rejected" ? "bg-red-50 text-red-700 border-red-200" :
                      "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                  >
                    Move to {STATUS_CONFIG[s]?.label}
                  </button>
                ))}
              </div>
            )}

            {/* AI Tool CTAs */}
            {app.resumeId && (
              <div className="flex gap-2 mt-4">
                <Link
                  to={`/resumes/${app.resumeId}/interview-questions?jobId=${app.jobId || ''}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 transition"
                >
                  Generate Interview Questions
                </Link>
                <Link
                  to={`/resumes/${app.resumeId}/salary-estimate?jobId=${app.jobId || ''}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 transition"
                >
                  Estimate Salary
                </Link>
              </div>
            )}

            {/* Resume used */}
            {app.resumeId && resumeName && (
              <p className="text-xs text-gray-400 mt-3">
                Applied with: <span className="font-medium text-gray-600">{resumeName}</span>
              </p>
            )}
          </div>

          <div className="border-b border-gray-100">
            <div className="flex">
              {(["overview", "comms", "referral"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition ${
                    tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t === "overview" ? "Overview" : t === "comms" ? `Communications (${comms.length})` : "Referral"}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {tab === "overview" && (
              <div className="space-y-4">
                {editMode ? (
                  <form onSubmit={handleUpdate} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                        <input value={editData.companyName} onChange={(e) => setEditData({ ...editData, companyName: e.target.value })} className="" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <input value={editData.roleTitle} onChange={(e) => setEditData({ ...editData, roleTitle: e.target.value })} className="" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea value={editData.notes} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} className="" rows={3} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Next Steps</label>
                      <textarea value={editData.nextSteps} onChange={(e) => setEditData({ ...editData, nextSteps: e.target.value })} className="" rows={2} />
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Save</button>
                      <button type="button" onClick={() => setEditMode(false)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <h3 className="text-sm font-semibold text-gray-900">Details</h3>
                      <button onClick={() => setEditMode(true)} className="text-sm text-blue-600 hover:text-blue-800">Edit</button>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-gray-500">Company:</span> <span className="text-gray-900">{app.companyName}</span></div>
                      <div><span className="text-gray-500">Role:</span> <span className="text-gray-900">{app.roleTitle}</span></div>
                      <div><span className="text-gray-500">Status:</span> <span className={`font-medium ${cfg.color}`}>{cfg.label}</span></div>
                      <div><span className="text-gray-500">Applied:</span> <span className="text-gray-900">{formatDate(app.appliedAt)}</span></div>
                      {app.job?.sourceUrl && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Job Link: </span>
                          <a href={app.job.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">{app.job.sourceUrl}</a>
                        </div>
                      )}
                    </div>
                    {app.notes && (
                      <div><span className="text-sm font-medium text-gray-700">Notes:</span><p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{app.notes}</p></div>
                    )}
                    {app.nextSteps && (
                      <div><span className="text-sm font-medium text-gray-700">Next Steps:</span><p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{app.nextSteps}</p></div>
                    )}
                    {app.nextActionAt && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                        Next action: {formatDate(app.nextActionAt)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === "comms" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-gray-900">Communication Log</h3>
                  <button onClick={() => setShowCommForm(true)} className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                    + Log Communication
                  </button>
                </div>

                {comms.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm">No communications logged yet</div>
                ) : (
                  <div className="space-y-3">
                    {comms.map((c) => (
                      <div key={c.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">{c.type}</span>
                            {c.direction && <span className={`text-xs ${c.direction === "inbound" ? "text-green-600" : "text-blue-600"}`}>{c.direction === "inbound" ? "← Inbound" : "→ Outbound"}</span>}
                          </div>
                          <span className="text-xs text-gray-400">{formatDateTime(c.occurredAt)}</span>
                        </div>
                        {c.subject && <div className="font-medium text-sm text-gray-900 mb-1">{c.subject}</div>}
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{c.content}</p>
                        {c.outcome && <div className="mt-2 text-xs text-gray-500">Outcome: {c.outcome}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "referral" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-gray-900">Referral</h3>
                  <button onClick={() => setShowRefForm(true)} className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                    {referral ? "Edit Referral" : "Add Referral"}
                  </button>
                </div>

                {referral ? (
                  <div className="border border-gray-200 rounded-lg p-4 space-y-2">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-gray-500">Name:</span> <span className="text-gray-900">{referral.employeeName}</span></div>
                      <div><span className="text-gray-500">Email:</span> <span className="text-gray-900">{referral.employeeEmail || "—"}</span></div>
                      <div><span className="text-gray-500">Relationship:</span> <span className="text-gray-900">{referral.relationship || "—"}</span></div>
                      <div><span className="text-gray-500">Status:</span> <span className="font-medium text-gray-900">{referral.status}</span></div>
                    </div>
                    {referral.notes && <div className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{referral.notes}</div>}
                    <div className="text-xs text-gray-400">
                      Requested: {formatDate(referral.requestedAt)}
                      {referral.respondedAt && ` • Responded: ${formatDate(referral.respondedAt)}`}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-gray-400 text-sm">No referral added yet</div>
                )}
              </div>
            )}
          </div>
        </div>

        {showCommForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCommForm(false)}>
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Log Communication</h2>
              <form onSubmit={handleAddComm} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select value={commForm.type} onChange={(e) => setCommForm({ ...commForm, type: e.target.value })} className="">
                      {COMM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Direction</label>
                    <select value={commForm.direction} onChange={(e) => setCommForm({ ...commForm, direction: e.target.value })} className="">
                      <option value="outbound">Outbound</option>
                      <option value="inbound">Inbound</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input value={commForm.subject} onChange={(e) => setCommForm({ ...commForm, subject: e.target.value })} className="" placeholder="Optional subject" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
                  <textarea value={commForm.content} onChange={(e) => setCommForm({ ...commForm, content: e.target.value })} className="" rows={4} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Outcome</label>
                  <input value={commForm.outcome} onChange={(e) => setCommForm({ ...commForm, outcome: e.target.value })} className="" placeholder="e.g. Scheduled follow-up" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowCommForm(false)} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Save</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showRefForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowRefForm(false)}>
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{referral ? "Edit Referral" : "Add Referral"}</h2>
              <form onSubmit={handleReferral} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee Name *</label>
                  <input value={refForm.employeeName} onChange={(e) => setRefForm({ ...refForm, employeeName: e.target.value })} className="" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={refForm.employeeEmail} onChange={(e) => setRefForm({ ...refForm, employeeEmail: e.target.value })} className="" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                    <input value={refForm.relationship} onChange={(e) => setRefForm({ ...refForm, relationship: e.target.value })} className="" placeholder="e.g. Former colleague" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select value={refForm.status} onChange={(e) => setRefForm({ ...refForm, status: e.target.value })} className="">
                      {REFERRAL_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={refForm.notes} onChange={(e) => setRefForm({ ...refForm, notes: e.target.value })} className="" rows={2} />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowRefForm(false)} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Save</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
