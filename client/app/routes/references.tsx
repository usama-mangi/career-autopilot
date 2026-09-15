import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { PageShell, PageHeader, Button, Input, Textarea, Card, Modal, ModalFooter, Select, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Reference Manager" },
  { name: "description", content: "Track references, contact info, and request status per application" },
];

export default function References() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [references, setReferences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRef, setEditingRef] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    title: "",
    email: "",
    phone: "",
    relationship: "",
    company: "",
    yearsKnown: "",
    notes: "",
    status: "not_contacted" as "not_contacted" | "contacted" | "agreed" | "declined",
  });

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadReferences();
  }, [isAuthenticated]);

  async function loadReferences() {
    try {
      const data = await api.references.list();
      setReferences(data);
    } catch (err) {
      console.error("Failed to load references:", err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      name: "",
      email: "",
      phone: "",
      relationship: "",
      company: "",
      title: "",
      yearsKnown: "",
      notes: "",
      status: "not_contacted" as "not_contacted" | "contacted" | "agreed" | "declined",
    });
    setEditingRef(null);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) return;
    setSaving(true);
    setError("");
    try {
      if (editingRef) {
        await api.references.update(editingRef.id, { ...formData, yearsKnown: formData.yearsKnown ? Number(formData.yearsKnown) : undefined });
        toastSuccess("Reference updated");
      } else {
        await api.references.create({ ...formData, yearsKnown: formData.yearsKnown ? Number(formData.yearsKnown) : undefined } as any);
        toastSuccess("Reference added");
      }
      setShowForm(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
    setSaving(false);
  }

  function handleEdit(ref: any) {
    setEditingRef(ref);
    setFormData({
      name: ref.name,
      title: ref.title || "",
      email: ref.email,
      phone: ref.phone || "",
      relationship: ref.relationship || "",
      company: ref.company || "",
      yearsKnown: ref.yearsKnown?.toString() || "",
      notes: ref.notes || "",
      status: ref.status || "not_contacted",
    });
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this reference?")) return;
    try {
      await api.references.delete(id);
      setReferences(prev => prev.filter(r => r.id !== id));
      toastSuccess("Reference deleted");
    } catch (err) {
      reportError(err, { title: "Delete failed", toastError });
    }
  }

  const statusLabels: Record<string, string> = {
    not_requested: "Not Requested",
    requested: "Requested",
    agreed: "Agreed",
    declined: "Declined",
    completed: "Completed",
  };

  const statusColors: Record<string, string> = {
    not_requested: "bg-gray-100 text-gray-600",
    requested: "bg-info-50 text-info-700",
    agreed: "bg-success-50 text-success-700",
    declined: "bg-danger-50 text-danger-700",
    completed: "bg-success-50 text-success-700",
  };

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Reference Manager" subtitle="Loading..." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Card key={i} className="h-48 animate-pulse bg-gray-100"><div className="h-full" /></Card>)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Reference Manager"
        subtitle="Track references, contact info, and request status per application"
        action={<Button onClick={() => { resetForm(); setShowForm(true); }}>+ Add Reference</Button>}
      />

      {error && <ErrorBanner error={error} />}

      {references.length === 0 ? (
        <Card className="text-center py-12">
          <svg className="mx-auto size-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM16 18a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="mt-4 text-gray-500">No references yet. Add your first reference to get started.</p>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="mt-4">Add Reference</Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {references.map(ref => (
            <Card key={ref.id} hover className="relative">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 truncate">{ref.name}</h3>
                  <p className="text-sm text-gray-500 truncate">{ref.company} · {ref.role}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[ref.status] || "bg-gray-100 text-gray-600"}`}>
                  {statusLabels[ref.status] || ref.status}
                </span>
              </div>

              <p className="text-sm text-gray-600 mb-2">{ref.email}</p>
              {ref.phone && <p className="text-sm text-gray-500 mb-2">{ref.phone}</p>}
              {ref.relationship && <p className="text-xs text-gray-500 mb-2">Relationship: {ref.relationship}</p>}
              {ref.yearsKnown && <p className="text-xs text-gray-500 mb-2">Known for {ref.yearsKnown} years</p>}
              {ref.notes && <p className="text-xs text-gray-500 mt-2 line-clamp-2">{ref.notes}</p>}

              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-400">Status: {statusLabels[ref.status] || ref.status}</span>
                <div className="flex-1"></div>
                <Button variant="ghost" size="sm" onClick={() => handleEdit(ref)}>Edit</Button>
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(ref.id)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); resetForm(); }}
        title={editingRef ? "Edit Reference" : "Add Reference"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorBanner error={error} className="mb-0" />}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Name"
              placeholder="e.g. Sarah Chen"
              value={formData.name}
              onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
              required
            />
            <Input
              label="Email"
              type="email"
              placeholder="e.g. sarah@company.com"
              value={formData.email}
              onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone"
              placeholder="e.g. (555) 123-4567"
              value={formData.phone}
              onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
            />
            <Select
              label="Relationship"
              value={formData.relationship}
              onChange={(e) => setFormData(p => ({ ...p, relationship: e.target.value }))}
              options={[
                { value: "former_manager", label: "Former Manager" },
                { value: "former_colleague", label: "Former Colleague" },
                { value: "mentor", label: "Mentor" },
                { value: "professor", label: "Professor" },
                { value: "client", label: "Client" },
                { value: "other", label: "Other" },
              ]}
              placeholder="Select relationship"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Current Company"
              placeholder="e.g. Google"
              value={formData.company}
              onChange={(e) => setFormData(p => ({ ...p, company: e.target.value }))}
            />
            <Input
              label="Current Role"
              placeholder="e.g. Engineering Manager"
              value={formData.title}
              onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Years Known"
              placeholder="e.g. 3"
              value={formData.yearsKnown}
              onChange={(e) => setFormData(p => ({ ...p, yearsKnown: e.target.value }))}
            />
            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData(p => ({ ...p, status: e.target.value as any }))}
              options={[
                { value: "not_contacted", label: "Not Contacted" },
                { value: "contacted", label: "Contacted" },
                { value: "agreed", label: "Agreed" },
                { value: "declined", label: "Declined" },
                { value: "completed", label: "Completed" },
              ]}
            />
          </div>
          <Textarea
            label="Notes"
            placeholder="Any additional context, preferred contact method, etc."
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
          />
          <ModalFooter
            actions={[
              { label: "Cancel", variant: "secondary", onClick: () => { setShowForm(false); resetForm(); } },
              { label: saving ? "Saving..." : (editingRef ? "Update" : "Save"), variant: "primary", onClick: handleSubmit, loading: saving },
            ]}
          />
        </form>
      </Modal>
    </PageShell>
  );
}