import type { CoverLetterTemplate } from "types";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import { PageShell, PageHeader, Button, Card, Input, Textarea, Modal, ModalFooter, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Cover Letter Templates" },
  { name: "description", content: "Manage your cover letter templates with variable substitution" },
];

const OPEN_BRACE = "{{";
const CLOSE_BRACE = "}}";
const PLACEHOLDER_EXAMPLES = [
  { key: "companyName", example: "Google" },
  { key: "roleTitle", example: "Senior Software Engineer" },
  { key: "hiringManager", example: "John Smith" },
  { key: "yourName", example: "Jane Doe" },
  { key: "yourEmail", example: "jane@email.com" },
  { key: "yourPhone", example: "(555) 123-4567" },
  { key: "date", example: "January 15, 2024" },
];

const TEMPLATE_PLACEHOLDER = `Dear ${OPEN_BRACE}hiringManager${CLOSE_BRACE},

I am writing to express my strong interest in the ${OPEN_BRACE}roleTitle${CLOSE_BRACE} position at ${OPEN_BRACE}companyName${CLOSE_BRACE}. With my background in ${OPEN_BRACE}yourField${CLOSE_BRACE} and passion for ${OPEN_BRACE}companyMission${CLOSE_BRACE}, I am confident I can contribute meaningfully to your team.

In my current role as ${OPEN_BRACE}currentRole${CLOSE_BRACE} at ${OPEN_BRACE}currentCompany${CLOSE_BRACE}, I have ${OPEN_BRACE}keyAchievement${CLOSE_BRACE}. This experience has honed my skills in ${OPEN_BRACE}relevantSkills${CLOSE_BRACE}, which align perfectly with the requirements of this position.

I am particularly drawn to ${OPEN_BRACE}companyName${CLOSE_BRACE} because of ${OPEN_BRACE}companyReason${CLOSE_BRACE}. Your commitment to ${OPEN_BRACE}companyValue${CLOSE_BRACE} resonates with my professional values.

Thank you for considering my application. I would welcome the opportunity to discuss how my experience aligns with your needs.

Sincerely,
${OPEN_BRACE}yourName${CLOSE_BRACE}
${OPEN_BRACE}yourEmail${CLOSE_BRACE} | ${OPEN_BRACE}yourPhone${CLOSE_BRACE}`;

export default function CoverLetterTemplates() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [templates, setTemplates] = useState<CoverLetterTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CoverLetterTemplate | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "", template: TEMPLATE_PLACEHOLDER, isDefault: false });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [applyingTemplate, setApplyingTemplate] = useState<CoverLetterTemplate | null>(null);
  const [applyVariables, setApplyVariables] = useState<Record<string, string>>({});
  const [applyResult, setApplyResult] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!isPending && !isAuthenticated) { navigate("/login"); return; }
    if (isAuthenticated) loadTemplates();
  }, [isAuthenticated, isPending]);

  async function loadTemplates() {
    setLoading(true);
    try {
      const data = await api.coverLetterTemplates.list();
      setTemplates(data);
    } catch (err) {
      console.error("Failed to load templates:", err);
    }
    setLoading(false);
  }

  function extractPlaceholders(text: string): string[] {
    const matches = text.match(new RegExp(`${OPEN_BRACE}(.*?)${CLOSE_BRACE}`, "g")) || [];
    return [...new Set(matches.map(m => m.slice(2, -2).trim()))];
  }

  function resetForm() {
    setFormData({ name: "", description: "", template: TEMPLATE_PLACEHOLDER, isDefault: false });
    setEditingTemplate(null);
    setError("");
    setSuccess("");
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    setSuccess("");
    try {
      const payload = { name: formData.name, description: formData.description || undefined, template: formData.template, isDefault: formData.isDefault };
      const created = editingTemplate
        ? await api.coverLetterTemplates.update(editingTemplate.id, payload)
        : await api.coverLetterTemplates.create(payload);
      setTemplates(editingTemplate ? templates.map(t => t.id === editingTemplate.id ? created : t) : [created, ...templates]);
      setShowForm(false);
      setSuccess(editingTemplate ? "Template updated" : "Template created");
      setTimeout(() => setSuccess(""), 3000);
      resetForm();
    } catch (err) {
      reportError(err, { title: "Save failed", toastError, setError, retry: handleSubmit });
    }
  };

  async function handleDelete(id: string) {
    try {
      await api.coverLetterTemplates.delete(id);
      setTemplates(templates.filter(t => t.id !== id));
      toastSuccess("Template deleted");
    } catch (err) {
      reportError(err, { title: "Delete failed", toastError });
    }
  };

  async function handleSetDefault(id: string) {
    try {
      const updated = await api.coverLetterTemplates.setDefault(id);
      setTemplates(templates.map(t => t.id === id ? updated : t));
      toastSuccess("Default template updated");
    } catch (err) {
      reportError(err, { title: "Update failed", toastError });
    }
  };

  function handleEdit(t: CoverLetterTemplate) {
    setEditingTemplate(t);
    setFormData({ name: t.name, description: t.description || "", template: t.template || "", isDefault: t.isDefault });
    setShowForm(true);
  }

  function handleApply(t: CoverLetterTemplate) {
    const placeholders = extractPlaceholders(t.template || "");
    const initialVars: Record<string, string> = {};
    placeholders.forEach(p => { initialVars[p] = PLACEHOLDER_EXAMPLES.find(e => e.key === p)?.example || ""; });
    setApplyingTemplate(t);
    setApplyVariables(initialVars);
    setApplyResult(null);
  }

  async function handleApplySubmit() {
      setApplying(true);
      try {
        const result = await api.coverLetterTemplates.apply(applyingTemplate!.id, applyVariables as any);
        setApplyResult(result.rendered);
      } catch (err) {
        reportError(err, { title: "Apply failed", toastError, retry: handleApplySubmit });
      }
      setApplying(false);
    }

  async function handleCopyResult() {
    if (!applyResult) return;
    try {
      await navigator.clipboard.writeText(applyResult);
      toastSuccess("Copied to clipboard");
    } catch {
      toastError("Failed to copy");
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Cover Letter Templates" subtitle="Loading templates..." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Cover Letter Templates"
        subtitle="Create and manage reusable cover letter templates with variable substitution"
        action={<Button onClick={() => { resetForm(); setShowForm(true); }}>+ New Template</Button>}
      />

      {error && <ErrorBanner error={error} />}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">{success}</div>}

      {templates.length === 0 ? (
        <Card className="text-center py-12">
          <svg className="mx-auto size-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-4 text-gray-500">No templates yet. Create your first cover letter template!</p>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="mt-4">Create Template</Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(t => (
            <Card key={t.id} className="relative">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{t.name}</h3>
                  {t.description && <p className="text-sm text-gray-500 mt-1">{t.description}</p>}
                  {t.isDefault && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-primary-50 text-primary-600 rounded-full mt-2">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6a1 1 0 10-2 0v4z" clipRule="evenodd" /></svg>
                    Default
                  </span>}
                </div>
              </div>
              <div className="font-mono text-xs text-gray-500 bg-gray-50 p-3 rounded-lg max-h-40 overflow-auto mb-3 whitespace-pre-wrap">
                {(t.template || "").slice(0, 300)}{(t.template || "").length > 300 ? "..." : ""}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => handleApply(t)}>Use Template</Button>
                <Button variant="ghost" size="sm" onClick={() => handleEdit(t)}>Edit</Button>
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(t.id)}>Delete</Button>
                {!t.isDefault && <Button variant="ghost" size="sm" onClick={() => handleSetDefault(t.id)}>Set Default</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingTemplate ? "Edit Template" : "New Template"} size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Template Name" placeholder="e.g. Standard Cover Letter" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
          <Input label="Description (optional)" placeholder="Brief description of when to use this template" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
          <div className="w-full">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Template Content</label>
            <Textarea
              placeholder={TEMPLATE_PLACEHOLDER}
              rows={15}
              value={formData.template}
              onChange={e => setFormData({ ...formData, template: e.target.value })}
              required
            />
            <p className="mt-1 text-xs text-gray-400">{"Use {{placeholder}} syntax. Available: {{companyName}}, {{roleTitle}}, {{hiringManager}}, {{yourName}}, {{yourEmail}}, {{yourPhone}}, {{date}}, and custom placeholders."}</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isDefault" checked={formData.isDefault} onChange={e => setFormData({ ...formData, isDefault: e.target.checked })} className="w-4 h-4 text-primary-500 border-gray-300 rounded" />
            <label htmlFor="isDefault" className="text-sm text-gray-700">Set as default template</label>
          </div>
          <ModalFooter
            actions={[
              { label: "Cancel", variant: "secondary", onClick: () => { setShowForm(false); resetForm(); } },
              { label: editingTemplate ? "Update Template" : "Create Template", variant: "primary", onClick: handleSubmit },
            ]}
          />
        </form>
      </Modal>

      {/* Apply Template Modal */}
      <Modal isOpen={!!applyingTemplate} onClose={() => { setApplyingTemplate(null); setApplyVariables({}); setApplyResult(null); }} title="Use Template" size="xl">
        {applyResult ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Generated Cover Letter</h3>
              <Button variant="secondary" size="sm" onClick={handleCopyResult}>Copy to Clipboard</Button>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-6 max-h-96 overflow-auto prose prose-sm">
              {applyResult.split("\n\n").map((para, i) => <p key={i}>{para}</p>)}
            </div>
            <Button onClick={() => { setApplyResult(null); setApplyVariables({}); }}>Create Another</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Fill in the variables for <strong>{applyingTemplate?.name}</strong></p>
            {extractPlaceholders(applyingTemplate?.template || "").map(key => (
              <Input
                key={key}
                label={key}
                placeholder={PLACEHOLDER_EXAMPLES.find(e => e.key === key)?.example || ""}
                value={applyVariables[key] || ""}
                onChange={e => setApplyVariables({ ...applyVariables, [key]: e.target.value })}
              />
            ))}
            <ModalFooter
              actions={[
                { label: "Cancel", variant: "secondary", onClick: () => { setApplyingTemplate(null); setApplyVariables({}); } },
                { label: "Generate", variant: "primary", onClick: handleApplySubmit, loading: applying },
              ]}
            />
          </div>
        )}
      </Modal>
    </PageShell>
  );
}