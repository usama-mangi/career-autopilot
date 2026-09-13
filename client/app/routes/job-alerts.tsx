import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { PageShell, PageHeader, Button, Card, useToastHelpers, reportError } from "~/components/ui";
import { Skeleton } from "~/components/Skeleton";

export const meta = () => [
  { title: "Career Autopilot | Job Alerts" },
  { name: "description", content: "Manage your job alert preferences" },
];

export default function JobAlerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        // Convert saved searches to alerts format
        setAlerts((data || []).filter((s: any) => s.enabled).map((s: any) => ({
          id: s.id,
          name: s.name,
          keywords: s.keywords,
          location: s.location,
          frequency: s.frequency,
          enabled: s.enabled,
          lastCheckedAt: s.lastRunAt,
          sources: s.sources,
        })));
      } catch (err) {
        console.error("Failed to load job alerts:", err);
      }
      setLoading(false);
    }
    load();
  }, [isAuthenticated]);

  async function handleToggle(id: string, enabled: boolean) {
    try {
      await api.jobs.savedSearches.update(id, { isActive: enabled });
      toastSuccess(enabled ? "Alert enabled" : "Alert disabled");
      setAlerts(alerts.map((a) => (a.id === id ? { ...a, enabled } : a)));
    } catch (err) {
      reportError(err, { title: "Update failed", toastError, retry: () => handleToggle(id, enabled) });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this job alert?")) return;
    try {
      await api.jobs.savedSearches.delete(id);
      toastSuccess("Deleted", "Job alert removed");
      setAlerts(alerts.filter((a) => a.id !== id));
    } catch (err) {
      reportError(err, { title: "Delete failed", toastError, retry: () => handleDelete(id) });
    }
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Job Alerts" subtitle="Loading..." />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Job Alerts"
        subtitle="Manage real-time notifications for new job postings"
        action={<Button onClick={() => navigate("/saved-searches")}>Create from Saved Search</Button>}
      />

      {alerts.length === 0 ? (
        <Card className="text-center py-12">
          <svg className="size-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No job alerts yet</h3>
          <p className="text-gray-500 mb-6">Create saved searches first, then enable alerts to get real-time notifications.</p>
          <Button onClick={() => navigate("/saved-searches")}>Create Saved Search</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <Card key={alert.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-gray-900 truncate">{alert.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${alert.enabled ? "bg-[#ECFDF5] text-[#065F46]" : "bg-gray-50 text-gray-500"}`}>
                    {alert.enabled ? "Active" : "Paused"}
                  </span>
                </div>
                <p className="text-sm text-gray-500 truncate">{alert.keywords} · {alert.location || "Anywhere"}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Frequency: {alert.frequency} · Last checked: {alert.lastCheckedAt ? new Date(alert.lastCheckedAt).toLocaleString() : "Never"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alert.enabled}
                    onChange={(e) => handleToggle(alert.id, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                </label>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(alert.id)} className="text-red-500 hover:text-red-600">
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}