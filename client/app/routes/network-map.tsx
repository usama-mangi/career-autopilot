import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import { PageShell, PageHeader, Button, Card, ScoreBadge, Select, Textarea, Modal, ModalFooter, Input, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";
import type { NetworkMap, NetworkContact, CoffeeChat } from "types";

export const meta = () => [
  { title: "Career Autopilot | Network Mapping" },
  { name: "description", content: "Identify key cross-functional contacts, schedule coffee chats, and build relationship map" },
];

function getImportanceColor(importance: string) {
  if (importance === "high") return "bg-red-100 text-red-700";
  if (importance === "medium") return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-700";
}

export default function NetworkMap() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [networks, setNetworks] = useState<NetworkMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    companyName: "",
    roleTitle: "",
    jobDescription: "",
  });

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadNetworks();
  }, [isAuthenticated]);

  async function loadNetworks() {
    setLoading(true);
    try {
      const data = await api.postOnboarding.listNetworks();
      setNetworks(data);
    } catch (err) {
      console.error("Failed to load networks:", err);
    }
    setLoading(false);
  }

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!formData.companyName || !formData.roleTitle) return;
    setSaving(true);
    setError("");
    try {
      const result = await api.postOnboarding.createNetwork({
        companyName: formData.companyName,
        roleTitle: formData.roleTitle,
        jobDescription: formData.jobDescription || undefined,
      });
      setNetworks(prev => [result, ...prev]);
      setShowForm(false);
      resetForm();
      toastSuccess("Network map generated", "Your contacts and coffee chats are ready");
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
    if (!confirm("Delete this network map?")) return;
    try {
      await api.postOnboarding.deleteNetwork(id);
      setNetworks(prev => prev.filter(n => n.id !== id));
      if (expandedId === id) setExpandedId(null);
      toastSuccess("Network map deleted");
    } catch (err) {
      reportError(err, { title: "Delete failed", toastError });
    }
  }

  function resetForm() {
    setFormData({ companyName: "", roleTitle: "", jobDescription: "" });
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Network Mapping" subtitle="Loading..." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Card key={i} className="h-48 animate-pulse bg-gray-100"><div className="h-full" /></Card>)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Network Mapping"
        subtitle="Identify key cross-functional contacts, schedule coffee chats, and build relationship map"
        action={<Button onClick={() => setShowForm(true)}>+ New Network Map</Button>}
      />

      {error && <ErrorBanner error={error} onRetry={handleCreate} />}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : networks.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-500">No network maps yet. Click "New Network Map" to get started.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {networks.map(network => (
            <Card key={network.id} hover onClick={() => setExpandedId(expandedId === network.id ? null : network.id)}>
              <div className="p-4 cursor-pointer hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{network.companyName} — {network.roleTitle}</h3>
                    <p className="text-sm text-gray-500">
                      {network.contacts?.length || 0} contacts · {network.coffeeChats?.length || 0} coffee chats
                      {" · "}{new Date(network.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDelete(network.id); }}>Delete</Button>
                </div>
              </div>

              {expandedId === network.id && (
                <div className="border-t border-gray-100 p-6 bg-gray-50 space-y-6">
                  {/* Contacts */}
                  {network.contacts?.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Key Contacts</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {network.contacts.map((contact: NetworkContact, idx: number) => (
                          <div key={idx} className="bg-white border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-gray-900 text-sm">{contact.name}</span>
                              <span className={cn("px-2 py-0.5 rounded text-xs font-medium", getImportanceColor(contact.importance))}>
                                {contact.importance}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500">{contact.role} · {contact.department}</p>
                            <p className="text-xs text-gray-500 mt-1">Goal: {contact.meetingGoal}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Coffee Chats */}
                  {network.coffeeChats?.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Coffee Chats</h4>
                      <div className="space-y-3">
                        {network.coffeeChats.map((chat: CoffeeChat, idx: number) => (
                          <div key={idx} className="bg-white border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-gray-900 text-sm">{chat.contactName}</span>
                              <span className="text-xs text-gray-500">{chat.suggestedTimeframe}</span>
                            </div>
                            <p className="text-xs text-gray-600 mb-2">{chat.agenda}</p>
                            {chat.questions && chat.questions.length > 0 && (
                              <div className="text-xs text-gray-500">
                                <p className="font-medium mb-1">Questions:</p>
                                <ul className="list-disc list-inside space-y-0.5">
                                  {chat.questions.map((q, i) => <li key={i}>{q}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Relationship Map */}
                  {network.relationshipMap && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Relationship Map</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(network.relationshipMap || {}).map(([category, contacts]) => (
                          <div key={category} className="bg-white border border-gray-200 rounded-lg p-3">
                            <p className="text-xs font-medium text-gray-500 mb-2 capitalize">{category.replace(/([A-Z])/g, ' $1')}</p>
                            <ul className="space-y-1">
                              {contacts?.map((name, i) => (
                                <li key={i} className="text-sm text-gray-700">{name}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); resetForm(); }}
        title="Generate Network Map"
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {error && <ErrorBanner error={error} />}
          <Input
            label="Company Name"
            placeholder="e.g. Google"
            value={formData.companyName}
            onChange={(e) => setFormData(p => ({ ...p, companyName: e.target.value }))}
            required
          />
          <Input
            label="Role Title"
            placeholder="e.g. Senior Software Engineer"
            value={formData.roleTitle}
            onChange={(e) => setFormData(p => ({ ...p, roleTitle: e.target.value }))}
            required
          />
          <Textarea
            label="Job Description (optional)"
            placeholder="Paste the job description for more tailored network mapping..."
            rows={3}
            value={formData.jobDescription}
            onChange={(e) => setFormData(p => ({ ...p, jobDescription: e.target.value }))}
          />
          <ModalFooter
            actions={[
              { label: "Cancel", variant: "secondary", onClick: () => { setShowForm(false); resetForm(); } },
              { label: saving ? "Generating..." : "Generate Network Map", variant: "primary", onClick: handleCreate, loading: saving },
            ]}
          />
        </form>
      </Modal>
    </PageShell>
  );
}