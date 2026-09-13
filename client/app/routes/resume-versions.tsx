import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import type { Resume, ResumeVersion } from "types";
import { useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Resume Versions" },
  {
    name: "description",
    content: "Manage multiple resume versions for different role types",
  },
];

export default function ResumeVersions() {
  const { id } = useParams();
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { error: toastError } = useToastHelpers();

  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    roleType: "",
    description: "",
    isPrimary: false,
  });

  const roleTypes = [
    { value: "engineering", label: "Engineering / Technical" },
    { value: "product", label: "Product Management" },
    { value: "management", label: "Engineering Management / Leadership" },
    { value: "data", label: "Data Science / ML" },
    { value: "design", label: "Design / UX" },
    { value: "marketing", label: "Marketing / Growth" },
    { value: "sales", label: "Sales / Business Development" },
    { value: "operations", label: "Operations / Program Management" },
    { value: "other", label: "Other" },
  ];

  useEffect(() => {
    if (!isPending && !isAuthenticated) {
      navigate(`/login`);
    }
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        const [resumeData, versionsData] = await Promise.all([
          api.resumes.get(id),
          api.resumes.getResumeVersions(id),
        ]);
        setResume(resumeData);
        setVersions(versionsData);
      } catch (err) {
        console.error("Failed to load resume versions:", err);
        setError("Failed to load resume versions");
      }
      setLoading(false);
    }
    loadData();
  }, [id]);

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!id) return;
    setCreating(true);
    setError("");

    try {
      // Get the base resume content to use as template
      const baseResume = await api.resumes.get(id);

      const content = {
        basics: { name: "", email: "", phone: "", location: "" },
        summary: baseResume.feedback ? "Customized for " + formData.roleType : "",
        skills: [] as string[],
        experience: [] as any[],
        education: [] as any[],
        projects: [] as any[],
      };

      const version = await api.resumes.createResumeVersion(id, {
        name: formData.name,
        roleType: formData.roleType,
        content: content as any,
        isPrimary: formData.isPrimary,
      });

      setVersions((prev) => [version, ...prev]);
      setShowCreate(false);
      setFormData({ name: "", roleType: "", description: "", isPrimary: false });
      setSuccess("Resume version created successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      reportError(err, {
        title: "Failed to create version",
        toastError,
        setError,
        retry: handleCreate,
      });
    }
    setCreating(false);
  }

  async function handleSetPrimary(versionId: string) {
    try {
      await api.resumes.setPrimaryResumeVersion(versionId);
      setVersions((prev) =>
        prev.map((v) => ({ ...v, isPrimary: v.id === versionId }))
      );
      setSuccess("Primary version updated!");
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      reportError(err, {
        title: "Failed to set primary",
        toastError,
        setError,
      });
    }
  }

  async function handleDelete(versionId: string) {
    if (!confirm("Are you sure you want to delete this version?")) return;
    try {
      await api.resumes.deleteResumeVersion(versionId);
      setVersions((prev) => prev.filter((v) => v.id !== versionId));
      setSuccess("Version deleted!");
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      reportError(err, {
        title: "Failed to delete version",
        toastError,
        setError,
      });
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getRoleTypeLabel(roleType: string) {
    return roleTypes.find((r) => r.value === roleType)?.label || roleType;
  }

  return (
    <main className="">
      <section className="page-content">
        <div className="page-header">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1>Resume Versions</h1>
              <p className="text-gray-600 mt-1">
                Create and manage tailored resume versions for different role types
              </p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="primary-button w-full sm:w-auto"
            >
              <img src="/icons/plus.svg" className="size-4 mr-2" alt="" />
              New Version
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <img src="/images/resume-scan-2.gif" className="w-[200px]" />
          </div>
        )}

        {!loading && !resume && (
          <div className="flex flex-col items-center gap-4 mt-8">
            <p className="text-lg text-gray-500">Resume not found.</p>
            <Link to="/upload" className="primary-button w-fit">
              Upload a Resume
            </Link>
          </div>
        )}

        {!loading && resume && (
          <div className="w-full max-w-4xl">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Base Resume</h2>
                  <p className="text-gray-600">{resume.jobTitle}</p>
                  {resume.companyName && (
                    <p className="text-sm text-gray-500">Target: {resume.companyName}</p>
                  )}
                </div>
                <Link
                  to={`/resumes/${id}`}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  <img src="/icons/back.svg" className="size-4" alt="" />
                  Back to Analysis
                </Link>
              </div>
            </div>

            {error && <ErrorBanner error={error} />}

            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                {success}
              </div>
            )}

            {/* Create Version Modal */}
            {showCreate && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Create Resume Version</h3>
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Version Name *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Senior Backend Engineer"
                        className=""
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role Type *</label>
                      <select
                        value={formData.roleType}
                        onChange={(e) => setFormData({ ...formData, roleType: e.target.value })}
                        className=""
                        required
                      >
                        <option value="">Select role type</option>
                        {roleTypes.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                        placeholder="What makes this version different? Key focus areas..."
                        className=""
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isPrimary"
                        checked={formData.isPrimary}
                        onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="isPrimary" className="text-sm text-gray-700">
                        Set as primary version for this role type
                      </label>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowCreate(false)}
                        className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={creating}
                        className="flex-1 px-4 py-2 primary-button disabled:opacity-50"
                      >
                        {creating ? "Creating..." : "Create Version"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Versions List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {versions.length === 0 ? (
                <div className="p-12 text-center">
                  <img src="/icons/file.svg" className="size-16 mx-auto text-gray-300 mb-4" alt="" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No versions yet</h3>
                  <p className="text-gray-500 mb-6">
                    Create your first resume version tailored for a specific role type
                  </p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="primary-button inline-flex items-center gap-2"
                  >
                    <img src="/icons/plus.svg" className="size-4" alt="" />
                    Create Version
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className="p-6 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-semibold text-gray-900">{version.name}</h4>
                            {version.isPrimary && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                Primary
                              </span>
                            )}
                            <span
                              className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full"
                            >
                              {getRoleTypeLabel(version.roleType)}
                            </span>
                          </div>
                          {version.content?._meta?.description && (
                            <p className="text-sm text-gray-500 mb-2">
                              {version.content._meta.description}
                            </p>
                          )}
                          <p className="text-xs text-gray-400">
                            Created {formatDate(version.createdAt)} • Updated {formatDate(version.updatedAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!version.isPrimary && (
                            <button
                              onClick={() => handleSetPrimary(version.id)}
                              className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              Set Primary
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/resume-versions/${id}/edit/${version.id}`)}
                            className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(version.id)}
                            className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                <Link
                  to={`/resumes/${id}/tailored`}
                  className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all text-center"
                >
                  <img src="/icons/magic.svg" className="size-8 mx-auto text-blue-600 mb-2" alt="" />
                  <p className="font-medium text-gray-900">Tailor Resume</p>
                  <p className="text-sm text-gray-500 mt-1">AI-powered customization for a specific job</p>
                </Link>
                <Link
                  to={`/resumes/${id}/cover-letter`}
                  className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all text-center"
                >
                  <img src="/icons/pin.svg" className="size-8 mx-auto text-blue-600 mb-2" alt="" />
                  <p className="font-medium text-gray-900">Cover Letter</p>
                  <p className="text-sm text-gray-500 mt-1">Generate tailored cover letter</p>
                </Link>
                <Link
                  to={`/resumes/${id}/skill-gap`}
                  className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all text-center"
                >
                  <img src="/icons/info.svg" className="size-8 mx-auto text-blue-600 mb-2" alt="" />
                  <p className="font-medium text-gray-900">Skill Gap</p>
                  <p className="text-sm text-gray-500 mt-1">Identify missing skills for target roles</p>
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
