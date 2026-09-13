import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import { useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Manager Alignment Tool" },
  { name: "description", content: "Shared expectations document with success metrics, communication style, and meeting cadence" },
];

export default function ManagerAlignment() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { error: toastError } = useToastHelpers();

  const [alignments, setAlignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    companyName: "",
    roleTitle: "",
    managerName: "",
    jobDescription: "",
  });

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadAlignments();
  }, [isAuthenticated]);

  async function loadAlignments() {
    setLoading(true);
    try {
      const data = await api.postOnboarding.listAlignments();
      setAlignments(data);
    } catch (err) {
      console.error("Failed to load alignments:", err);
    }
    setLoading(false);
  }

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!formData.companyName || !formData.roleTitle) return;
    setSaving(true);
    setError("");
    try {
      const result = await api.postOnboarding.createAlignment({
        companyName: formData.companyName,
        roleTitle: formData.roleTitle,
        managerName: formData.managerName || "",
        jobDescription: formData.jobDescription || undefined,
      } as any);
      setAlignments(prev => [result, ...prev]);
      setShowForm(false);
      resetForm();
    } catch (err) {
      reportError(err, {
        title: "Generation failed",
        toastError,
        setError,
        retry: handleCreate,
      });
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this manager alignment?")) return;
    try {
      await api.postOnboarding.deleteAlignment(id);
      setAlignments(prev => prev.filter(a => a.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  function resetForm() {
    setFormData({ companyName: "", roleTitle: "", managerName: "", jobDescription: "" });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Manager Alignment Tool</h1>
            <p className="text-gray-600 mt-1">Shared expectations document with success metrics, communication style, and meeting cadence</p>
          </div>
          <button onClick={() => setShowForm(true)} className="primary-button">+ New Alignment</button>
        </div>

        {error && <ErrorBanner error={error} onRetry={handleCreate} className="mb-6" />}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : alignments.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500">No manager alignment documents yet. Click "New Alignment" to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {alignments.map(alignment => (
              <div key={alignment.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpandedId(expandedId === alignment.id ? null : alignment.id)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{alignment.companyName} — {alignment.roleTitle}</h3>
                      <p className="text-sm text-gray-500">
                        {alignment.managerName ? `Manager: ${alignment.managerName} · ` : ""}
                        {new Date(alignment.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(alignment.id); }} className="text-red-400 hover:text-red-600 text-sm">Delete</button>
                  </div>
                </div>

                {expandedId === alignment.id && (
                  <div className="border-t border-gray-100 p-6 bg-gray-50 space-y-6">
                    {/* Success Metrics */}
                    {alignment.successMetrics?.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Success Metrics</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {alignment.successMetrics.map((metric: any, idx: number) => (
                            <div key={idx} className="bg-white border border-gray-200 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-gray-900 text-sm">{metric.metric}</span>
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{metric.timeframe}</span>
                              </div>
                              <p className="text-xs text-gray-600">{metric.description}</p>
                              {metric.measurementMethod && (
                                <p className="text-xs text-gray-500 mt-1">Measure: {metric.measurementMethod}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Communication Style */}
                    {alignment.communicationStyle && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Communication Style</h4>
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-medium text-gray-500">Preferred Channels</p>
                              <p className="text-sm text-gray-900">{alignment.communicationStyle.preferredChannels?.join(", ")}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500">Meeting Frequency</p>
                              <p className="text-sm text-gray-900">{alignment.communicationStyle.meetingFrequency}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500">Feedback Style</p>
                              <p className="text-sm text-gray-900">{alignment.communicationStyle.feedbackStyle}</p>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500">Response Time</p>
                              <p className="text-sm text-gray-900">{alignment.communicationStyle.responseTimeExpectations}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Meeting Cadence */}
                    {alignment.meetingCadence?.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Meeting Cadence</h4>
                        <div className="space-y-2">
                          {alignment.meetingCadence.map((meeting: any, idx: number) => (
                            <div key={idx} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900 text-sm">{meeting.type}</p>
                                <p className="text-xs text-gray-500">{meeting.purpose}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-gray-900">{meeting.frequency}</p>
                                <p className="text-xs text-gray-500">{meeting.duration}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Expectations */}
                    {alignment.expectations && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Expectations</h4>
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{alignment.expectations}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Generate Manager Alignment</h2>
                <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                  <input type="text" required value={formData.companyName} onChange={e => setFormData(p => ({ ...p, companyName: e.target.value }))} className="" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role Title *</label>
                  <input type="text" required value={formData.roleTitle} onChange={e => setFormData(p => ({ ...p, roleTitle: e.target.value }))} className="" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manager Name</label>
                  <input type="text" value={formData.managerName} onChange={e => setFormData(p => ({ ...p, managerName: e.target.value }))} className="" placeholder="Optional" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Job Description (optional)</label>
                  <textarea rows={3} value={formData.jobDescription} onChange={e => setFormData(p => ({ ...p, jobDescription: e.target.value }))} className="" placeholder="Paste the job description for more tailored expectations..." />
                </div>

                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                  <button type="submit" disabled={saving} className="primary-button">{saving ? "Generating..." : "Generate Alignment"}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
