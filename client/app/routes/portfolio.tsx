import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import type { Project } from "types";
import { PageShell, PageHeader, Button, Input, Textarea, Card, Modal, ModalFooter, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export default function Portfolio() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    projectUrl: "",
    githubUrl: "",
    demoUrl: "",
    technologies: "",
    role: "",
    startDate: "",
    endDate: "",
    isPublic: true,
  });

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    async function loadProjects() {
      try {
        const data = await api.portfolio.list();
        setProjects(data);
      } catch (err) {
        console.error("Failed to load projects:", err);
      }
      setLoading(false);
    }
    loadProjects();
  }, [isAuthenticated]);

  function resetForm() {
    setFormData({
      title: "",
      description: "",
      projectUrl: "",
      githubUrl: "",
      demoUrl: "",
      technologies: "",
      role: "",
      startDate: "",
      endDate: "",
      isPublic: true,
    });
    setEditingProject(null);
    setError("");
    setSuccess("");
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const isEditing = !!editingProject;
    const submitFn = isEditing ? api.portfolio.update : api.portfolio.create;
    const technologies = formData.technologies.split(",").map((t) => t.trim()).filter(Boolean);

    if (!formData.title.trim() || !formData.description.trim()) {
      setError("Title and description are required");
      return;
    }

    try {
      if (isEditing) setUpdating(true);
      else setCreating(true);

      const body = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        projectUrl: formData.projectUrl.trim() || undefined,
        githubUrl: formData.githubUrl.trim() || undefined,
        demoUrl: formData.demoUrl.trim() || undefined,
        technologies,
        role: formData.role.trim() || undefined,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        isPublic: formData.isPublic,
      };

      if (isEditing) {
        await api.portfolio.update(editingProject!.id, body as any);
        toastSuccess("Project updated");
      } else {
        const created = await api.portfolio.create(body as any);
        setProjects((prev) => [created, ...prev]);
        toastSuccess("Project added");
      }
      resetForm();
      setShowForm(false);
    } catch (err: any) {
      reportError(err, { title: "Save failed", toastError, setError, retry: handleSubmit });
    } finally {
      setCreating(false);
      setUpdating(false);
    }
  }

  function handleEdit(project: Project) {
    setEditingProject(project);
    setFormData({
      title: project.title,
      description: project.description,
      projectUrl: project.projectUrl || "",
      githubUrl: project.githubUrl || "",
      demoUrl: project.demoUrl || "",
      technologies: project.technologies.join(", "),
      role: project.role || "",
      startDate: project.startDate || "",
      endDate: project.endDate || "",
      isPublic: project.isPublic,
    });
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this project?")) return;
    try {
      await api.portfolio.delete(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toastSuccess("Project deleted");
    } catch (err) {
      reportError(err, { title: "Delete failed", toastError });
    }
  }

  function formatDateRange(project: Project) {
    if (!project.startDate && !project.endDate) return "";
    const start = project.startDate ? new Date(project.startDate) : null;
    const end = project.endDate ? new Date(project.endDate) : null;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const startStr = start ? `${monthNames[start.getMonth()]} ${start.getFullYear()}` : "\u2014";
    const endStr = end ? `${monthNames[end.getMonth()]} ${end.getFullYear()}` : "Present";
    return `${startStr} \u2013 ${endStr}`;
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Portfolio" subtitle="Loading your projects..." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Portfolio / Project Showcase"
        subtitle={`${projects.length} project${projects.length !== 1 ? "s" : ""}`}
        action={<Button onClick={() => { resetForm(); setShowForm(true); }}>+ Add Project</Button>}
      />

      {error && <ErrorBanner error={error} />}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">{success}</div>}

      {projects.length === 0 ? (
        <Card className="text-center py-12">
          <svg className="mx-auto size-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="mt-4 text-gray-500">No projects yet. Add your first project to build your portfolio!</p>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="mt-4">Add Project</Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} hover>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 truncate">{project.title}</h3>
                  {project.role && <p className="text-sm text-blue-600 mt-0.5">{project.role}</p>}
                </div>
                {project.isPublic && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    Public
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-600 mb-3 line-clamp-3">{project.description}</p>

              {project.technologies.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {project.technologies.map((tech) => (
                    <span key={tech} className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded text-xs font-medium">{tech}</span>
                  ))}
                </div>
              )}

              {formatDateRange(project) && (
                <p className="text-xs text-gray-400 mb-3">{formatDateRange(project)}</p>
              )}

              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                {project.projectUrl && (
                  <Link to={project.projectUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary-600 hover:underline">
                    Live Demo
                  </Link>
                )}
                {project.githubUrl && (
                  <Link to={project.githubUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-gray-600 hover:underline">
                    GitHub
                  </Link>
                )}
                {project.demoUrl && (
                  <Link to={project.demoUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-gray-600 hover:underline">
                    Demo
                  </Link>
                )}
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">Created {formatDate(project.createdAt)}</span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(project)}>Edit</Button>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(project.id)}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); resetForm(); }}
        title={editingProject ? "Edit Project" : "Add Project"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorBanner error={error} className="mb-0" />}
          <Input
            label="Project Title *"
            placeholder="e.g. E-commerce Platform"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
          <Textarea
            label="Description *"
            placeholder="Describe the project, your role, challenges, and outcomes..."
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Live URL"
              placeholder="https://yourproject.com"
              value={formData.projectUrl}
              onChange={(e) => setFormData({ ...formData, projectUrl: e.target.value })}
            />
            <Input
              label="GitHub URL"
              placeholder="https://github.com/you/repo"
              value={formData.githubUrl}
              onChange={(e) => setFormData({ ...formData, githubUrl: e.target.value })}
            />
          </div>
          <Input
            label="Demo Video URL"
            placeholder="https://youtube.com/... or https://loom.com/..."
            value={formData.demoUrl}
            onChange={(e) => setFormData({ ...formData, demoUrl: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Role"
              placeholder="e.g. Full Stack Developer, Tech Lead"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            />
            <Input
              label="Technologies (comma-separated)"
              placeholder="React, Node.js, PostgreSQL, AWS"
              value={formData.technologies}
              onChange={(e) => setFormData({ ...formData, technologies: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="month"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            />
            <Input
              label="End Date"
              type="month"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isPublic" checked={formData.isPublic} onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })} className="w-4 h-4 text-primary-500 border-gray-300 rounded" />
            <label htmlFor="isPublic" className="text-sm text-gray-700">Make this project public</label>
          </div>
          <ModalFooter
            actions={[
              { label: "Cancel", variant: "secondary", onClick: () => { setShowForm(false); resetForm(); } },
              { label: editingProject ? "Update Project" : "Create Project", variant: "primary", onClick: handleSubmit, loading: creating || updating },
            ]}
          />
        </form>
      </Modal>
    </PageShell>
  );
}