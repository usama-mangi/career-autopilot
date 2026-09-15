import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { PageShell, PageHeader, Button, Input, Textarea, Card, Modal, ModalFooter, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Skill Refresh Recommendations" },
  { name: "description", content: "Pre-start learning path based on tech stack, domain, and tools" },
];

function getPriorityColor(priority: string) {
  if (priority === "high") return "bg-red-100 text-red-700";
  if (priority === "medium") return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-700";
}

function getLevelColor(level: string) {
  if (level === "expert") return "bg-primary-50 text-primary-600";
  if (level === "advanced") return "bg-info-50 text-info-700";
  if (level === "intermediate") return "bg-success-50 text-success-700";
  return "bg-gray-100 text-gray-700";
}

export default function SkillRefresh() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [techStackInput, setTechStackInput] = useState("");

  const [formData, setFormData] = useState({
    companyName: "",
    roleTitle: "",
    jobDescription: "",
    techStack: [] as string[],
  });

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadSkills();
  }, [isAuthenticated]);

  async function loadSkills() {
    setLoading(true);
    try {
      const data = await api.postOnboarding.listSkills();
      setSkills(data);
    } catch (err) {
      console.error("Failed to load skills:", err);
    }
    setLoading(false);
  }

  function addTechStack() {
    if (!techStackInput.trim()) return;
    setFormData((p) => ({ ...p, techStack: [...p.techStack, techStackInput.trim()] }));
    setTechStackInput("");
  }

  function removeTechStack(idx: number) {
    setFormData((p) => ({ ...p, techStack: p.techStack.filter((_, i) => i !== idx) }));
  }

  async function handleCreate(e?: FormEvent) {
    e?.preventDefault();
    if (!formData.companyName || !formData.roleTitle || formData.techStack.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const result = await api.postOnboarding.createSkill({
        companyName: formData.companyName,
        roleTitle: formData.roleTitle,
        techStack: formData.techStack,
        learningPath: [],
      } as any);
      setSkills((prev) => [result, ...prev]);
      setShowForm(false);
      resetForm();
      toastSuccess("Skill refresh generated", "Your learning path is ready");
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
    if (!confirm("Delete this skill refresh?")) return;
    try {
      await api.postOnboarding.deleteSkill(id);
      setSkills((prev) => prev.filter((s) => s.id !== id));
      if (expandedId === id) setExpandedId(null);
      toastSuccess("Skill refresh deleted");
    } catch (err) {
      reportError(err, { title: "Delete failed", toastError });
    }
  }

  function resetForm() {
    setFormData({ companyName: "", roleTitle: "", jobDescription: "", techStack: [] });
    setTechStackInput("");
    setError("");
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Skill Refresh Recommendations" subtitle="Loading..." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Card key={i} className="h-48 animate-pulse bg-gray-100"><span>{i}</span></Card>)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Skill Refresh Recommendations"
        subtitle="Pre-start learning path based on tech stack, domain, and tools"
        action={<Button onClick={() => { resetForm(); setShowForm(true); }}>+ New Skill Refresh</Button>}
      />

      {error && <ErrorBanner error={error} onRetry={handleCreate} />}

      {skills.length === 0 ? (
        <Card className="text-center py-12">
          <svg className="mx-auto size-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6m19 0c-1.232.477-2.818.5-4.5 0-1.706.5-3.292.53-5 0-1.706-.5-3.292-.53-5 0-1.707-.5-3.292-.53-5 0-1.707.5-3.292-.53-5 0-1.707.5-3.292.53-5 0 1.707-.5 3.292-.53 5 0 1.706.5 3.292.53 5 0" />
          </svg>
          <p className="mt-4 text-gray-500">No skill refresh recommendations yet. Click "New Skill Refresh" to get started.</p>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="mt-4">Generate Skill Refresh</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {skills.map((skill) => (
            <Card key={skill.id} hover onClick={() => setExpandedId(expandedId === skill.id ? null : skill.id)}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 truncate">{skill.companyName} \u2014 {skill.roleTitle}</h3>
                  <p className="text-sm text-gray-500 truncate">{skill.techStack?.join(", ")}</p>
                </div>
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={(e) => { e.stopPropagation(); handleDelete(skill.id); }}>Delete</Button>
              </div>
              <p className="text-sm text-gray-500 mb-2">
                {skill.techStack?.join(", ")}
                {" \u00b7 "}{skill.estimatedHours ? `~${skill.estimatedHours} hours` : ""}
                {" \u00b7 "}{new Date(skill.createdAt).toLocaleDateString()}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); resetForm(); }}
        title="Generate Skill Refresh"
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {error && <ErrorBanner error={error} />}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tech Stack (at least one)</label>
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="e.g. React, Node.js, PostgreSQL"
                value={techStackInput}
                onChange={(e) => setTechStackInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTechStack())}
              />
              <Button type="button" variant="secondary" onClick={addTechStack} className="h-10">Add</Button>
            </div>
            {formData.techStack.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.techStack.map((tech, i) => (
                  <span key={i} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                    {tech}
                    <Button type="button" variant="ghost" size="sm" className="text-blue-500 hover:text-blue-700 p-0.5" onClick={() => removeTechStack(i)}>&times;</Button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <Textarea
            label="Job Description (optional)"
            placeholder="Paste the job description for more tailored recommendations..."
            rows={3}
            value={formData.jobDescription}
            onChange={(e) => setFormData((p) => ({ ...p, jobDescription: e.target.value }))}
          />
          <ModalFooter
            actions={[
              { label: "Cancel", variant: "secondary", onClick: () => { setShowForm(false); resetForm(); } },
              { label: saving ? "Generating..." : "Generate Recommendations", variant: "primary", onClick: handleCreate, loading: saving },
            ]}
          />
        </form>
      </Modal>
    </PageShell>
  );
}
