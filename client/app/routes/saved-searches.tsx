import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { PageShell, PageHeader, Button, Card, Input, Select, useToastHelpers, reportError } from "~/components/ui";
import { Skeleton } from "~/components/Skeleton";

export const meta = () => [
  { title: "Career Autopilot | Saved Searches" },
  { name: "description", content: "Manage your saved job searches and alerts" },
];

interface SavedSearchForm {
  name: string;
  keywords: string;
  location: string;
  sources: string[];
  jobTypes: string[];
  remoteTypes: string[];
  experienceLevels: string[];
  frequency: string;
}

export default function SavedSearches() {
  const [searches, setSearches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<SavedSearchForm>({
    name: "",
    keywords: "",
    location: "",
    sources: ["linkedin", "indeed"],
    jobTypes: [],
    remoteTypes: [],
    experienceLevels: [],
    frequency: "daily",
  });

  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    async function load() {
      try {
        const data = await api.jobs.savedSearches.list();
        setSearches(data || []);
      } catch (err) {
        console.error("Failed to load saved searches:", err);
      }
      setLoading(false);
    }
    load();
  }, [isAuthenticated]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    try {
      const payload = {
        name: formData.name,
        keywords: formData.keywords.split(",").map((k) => k.trim()).filter(Boolean),
        location: formData.location,
        sources: formData.sources,
        jobTypes: formData.jobTypes,
        remoteTypes: formData.remoteTypes,
        experienceLevels: formData.experienceLevels,
        frequency: formData.frequency,
        enabled: true,
      };
      await api.jobs.savedSearches.create(payload);
      toastSuccess("Search saved", "You'll get alerts for new matching jobs");
      setShowForm(false);
      setFormData({ name: "", keywords: "", location: "", sources: ["linkedin", "indeed"], jobTypes: [], remoteTypes: [], experienceLevels: [], frequency: "daily" });
      const data = await api.jobs.savedSearches.list();
      setSearches(data || []);
    } catch (err) {
      reportError(err, { title: "Save failed", toastError, retry: handleSubmit });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this saved search?")) return;
    try {
      await api.jobs.savedSearches.delete(id);
      toastSuccess("Deleted", "Saved search removed");
      setSearches(searches.filter((s) => s.id !== id));
    } catch (err) {
      reportError(err, { title: "Delete failed", toastError, retry: () => handleDelete(id) });
    }
  }

  async function handleRun(id: string) {
    try {
      await api.jobs.savedSearches.run(id);
      toastSuccess("Search running", "Results will appear on the Jobs page");
    } catch (err) {
      reportError(err, { title: "Run failed", toastError, retry: () => handleRun(id) });
    }
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Saved Searches" subtitle="Loading..." />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </PageShell>
    );
  }

  const SOURCES = [
    { value: "linkedin", label: "LinkedIn" },
    { value: "indeed", label: "Indeed" },
    { value: "glassdoor", label: "Glassdoor" },
    { value: "jsearch", label: "JSearch (Aggregator)" },
    { value: "company", label: "Company Career Pages" },
  ];

  const JOB_TYPES = [
    { value: "full_time", label: "Full-time" },
    { value: "part_time", label: "Part-time" },
    { value: "contract", label: "Contract" },
    { value: "internship", label: "Internship" },
    { value: "temporary", label: "Temporary" },
  ];

  const REMOTE_TYPES = [
    { value: "remote", label: "Remote" },
    { value: "hybrid", label: "Hybrid" },
    { value: "onsite", label: "On-site" },
  ];

  const EXPERIENCE_LEVELS = [
    { value: "entry", label: "Entry Level" },
    { value: "mid", label: "Mid Level" },
    { value: "senior", label: "Senior" },
    { value: "lead", label: "Lead/Principal" },
    { value: "executive", label: "Executive" },
  ];

  const FREQUENCIES = [
    { value: "realtime", label: "Real-time" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
  ];

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Saved Searches"
        subtitle="Get notified when new jobs match your criteria"
        action={!showForm && (
          <Button onClick={() => setShowForm(true)}>Create Search</Button>
        )}
      />

      {showForm && (
        <Card className="mb-6 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Search Name"
                placeholder="e.g., Senior React Roles - Remote"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Input
                label="Keywords"
                placeholder="react, typescript, nextjs"
                value={formData.keywords}
                onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                required
              />
              <Input
                label="Location"
                placeholder="San Francisco, CA or Remote"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
              <Select
                label="Alert Frequency"
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                options={FREQUENCIES}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sources</label>
              <div className="flex flex-wrap gap-2">
                {SOURCES.map((s) => (
                  <label key={s.value} className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.sources.includes(s.value)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData({
                          ...formData,
                          sources: e.target.checked
                            ? [...formData.sources, s.value]
                            : formData.sources.filter((v) => v !== s.value),
                        })
                      }
                      className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Job Types</label>
                <div className="flex flex-wrap gap-2">
                  {JOB_TYPES.map((j) => (
                    <label key={j.value} className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.jobTypes.includes(j.value)}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData({
                            ...formData,
                            jobTypes: e.target.checked
                              ? [...formData.jobTypes, j.value]
                              : formData.jobTypes.filter((v) => v !== j.value),
                          })
                        }
                        className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                      />
                      {j.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Remote Types</label>
                <div className="flex flex-wrap gap-2">
                  {REMOTE_TYPES.map((r) => (
                    <label key={r.value} className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.remoteTypes.includes(r.value)}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData({
                            ...formData,
                            remoteTypes: e.target.checked
                              ? [...formData.remoteTypes, r.value]
                              : formData.remoteTypes.filter((v) => v !== r.value),
                          })
                        }
                        className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Experience Levels</label>
                <div className="flex flex-wrap gap-2">
                  {EXPERIENCE_LEVELS.map((level) => (
                    <label key={level.value} className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.experienceLevels.includes(level.value)}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData({
                            ...formData,
                            experienceLevels: e.target.checked
                              ? [...formData.experienceLevels, level.value]
                              : formData.experienceLevels.filter((v) => v !== level.value),
                          })
                        }
                        className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                      />
                      {level.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit">Save Search</Button>
            </div>
          </form>
        </Card>
      )}

      {searches.length === 0 && !showForm ? (
        <Card className="text-center py-12">
          <svg className="size-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No saved searches yet</h3>
          <p className="text-gray-500 mb-6">Create a saved search to get notified when new jobs match your criteria.</p>
          <Button onClick={() => setShowForm(true)}>Create Your First Search</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {searches.map((search) => (
            <Card key={search.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-gray-900 truncate">{search.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${search.enabled ? "bg-[#ECFDF5] text-[#065F46]" : "bg-gray-50 text-gray-500"}`}>
                    {search.enabled ? "Alerts ON" : "Alerts OFF"}
                  </span>
                </div>
                <p className="text-sm text-gray-500 truncate">{search.keywords} · {search.location || "Anywhere"}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Sources: {search.sources?.join(", ") || "All"} · Frequency: {search.frequency}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleRun(search.id)}>Run Now</Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(search.id)} className="text-red-500 hover:text-red-600">Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}