import { useParams, useNavigate, Link } from "react-router";
import { useEffect, useState } from "react";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { useJobsStore } from "~/lib/jobs-store";
import { cn } from "~/lib/utils";
import { PageShell, Button, Modal, ModalFooter, useToastHelpers, ScoreBadge, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Job Details" },
];

const SOURCE_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  linkedin: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  indeed: { bg: "bg-[#FFF8F0]", text: "text-primary-700", dot: "bg-primary-500" },
  glassdoor: { bg: "bg-[#ECFDF5]", text: "text-[#065F46]", dot: "bg-[#065F46]" },
  jsearch: { bg: "bg-[#FFFBEB]", text: "text-[#A16207]", dot: "bg-[#A16207]" },
  company: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
};

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [skillMatch, setSkillMatch] = useState<{ percentage: number; matchedSkills: string[]; missingSkills: string[] } | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [hasTailoredResume, setHasTailoredResume] = useState(false);
  const [resumes, setResumes] = useState<any[]>([]);
  const [existingApplication, setExistingApplication] = useState<{ id: string; status: string } | null>(null);

  // Cover letter modal
  const [showCoverLetter, setShowCoverLetter] = useState(false);
  const [coverLetterResult, setCoverLetterResult] = useState<string | null>(null);
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [coverLetterError, setCoverLetterError] = useState("");

  // Mark applied modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedResumeForApply, setSelectedResumeForApply] = useState<string>("");
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && id) {
      loadJobDetails();
      loadResumes();
    }
  }, [isAuthenticated, id]);

  // Lifecycle: if this job is already being tracked, surface that instead of
  // letting the user apply twice.
  useEffect(() => {
    if (!isAuthenticated || !id) return;
    let cancelled = false;
    api.applications
      .list({ limit: 100 })
      .then((data) => {
        if (cancelled) return;
        const match = (data.applications || []).find((a) => a.jobId === id);
        setExistingApplication(match ? { id: match.id, status: match.status } : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, id, job?.appliedAt]);

  async function loadJobDetails() {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.jobs.getDetails(id);
      setJob(data.job);
      setSkillMatch(data.skillMatch || null);
      setResumeId(data.resumeId || null);

      // Check if a tailored resume already exists for this resume and this specific job
      if (data.resumeId) {
        try {
          const tailored = await api.resumes.getTailoredResume(data.resumeId as string, id);
          setHasTailoredResume(!!tailored && !!tailored.tailoredResume);
        } catch {
          setHasTailoredResume(false);
        }
      }
    } catch (err) {
      setError("Job not found");
    }
    setLoading(false);
  }

  async function loadResumes() {
    try {
      const data = await api.resumes.list();
      setResumes(data);
      if (data.length > 0) setSelectedResumeForApply(data[0].id);
    } catch (err) {
      console.error("Failed to load resumes:", err);
    }
  }

  async function handleToggleBookmark() {
    if (!id) return;
    try {
      const updated = await api.jobs.toggleBookmark(id);
      setJob(updated);
      useJobsStore.getState().toggleBookmark(id);
    } catch (err) {
      reportError(err, { title: "Action failed", toastError, retry: handleToggleBookmark });
    }
  }

  async function handleApplyConfirm() {
    if (!id || !job || !selectedResumeForApply) return;
    setApplying(true);
    try {
      const newApp = await api.applications.create({
        jobId: id,
        companyName: job.companyName,
        roleTitle: job.title,
        resumeId: selectedResumeForApply,
      });
      await api.jobs.markAsApplied(id);
      setJob((prev: any) => ({ ...prev, appliedAt: new Date().toISOString() }));
      useJobsStore.getState().markAsApplied(id);
      setShowApplyModal(false);
      setExistingApplication({ id: newApp.id, status: newApp.status || "applied" });
      toastSuccess("Application created", "Redirecting to application details...");
      navigate(`/applications/${newApp.id}`);
    } catch (err) {
      reportError(err, { title: "Application failed", toastError, retry: handleApplyConfirm });
    }
    setApplying(false);
  }

  async function handleGenerateCoverLetter() {
    if (!resumeId || !job) return;
    setShowCoverLetter(true);
    setCoverLetterLoading(true);
    setCoverLetterError("");
    setCoverLetterResult(null);
    try {
      const result = await api.resumes.coverLetter(resumeId, {
        companyName: job.companyName,
        jobDescription: job.description || "",
      } as any);
      setCoverLetterResult(result.content || JSON.stringify(result, null, 2));
    } catch (err) {
      setCoverLetterError(err instanceof Error ? err.message : "Failed to generate cover letter");
    }
    setCoverLetterLoading(false);
  }

  if (isPending || loading) {
    return (
      <PageShell>
        <div className="space-y-6 animate-pulse">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-4 w-32 bg-gray-200 rounded" />
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-48 bg-gray-200 rounded-xl" />
              <div className="h-64 bg-gray-200 rounded-xl" />
            </div>
            <div className="h-64 bg-gray-200 rounded-xl" />
          </div>
        </div>
      </PageShell>
    );
  }

  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  if (error || !job) {
    return (
      <PageShell>
        <div className="text-center py-20">
          <p className="text-lg font-semibold text-gray-900 mb-2">Job Not Found</p>
          <p className="text-sm text-gray-500 mb-6">This job posting could not be loaded or no longer exists.</p>
          <Button variant="secondary" onClick={() => navigate("/jobs")}>Back to Search</Button>
        </div>
      </PageShell>
    );
  }

  const sourceStyle = SOURCE_STYLES[job.source] || SOURCE_STYLES.jsearch;
  const hasResume = resumes.length > 0;

  return (
    <PageShell maxWidth="xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link to="/jobs" className="hover:text-primary-600 transition-colors">Jobs</Link>
        <span>/</span>
        <span className="text-gray-600 truncate">{job.title}</span>
      </nav>

      {/* Hero */}
      <div className="bg-[#FFF8F0] border border-[#E8DDD1] rounded-2xl p-6 sm:p-8 mb-8 shadow-sm">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${sourceStyle.bg} ${sourceStyle.text}`}>
            {job.source}
          </span>
          {job.isBookmarked && <span className="text-amber-400 text-lg">★</span>}
          {job.appliedAt && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-success-50 text-success">Applied</span>
          )}
          {skillMatch && (
            <div className="flex items-center gap-2 ml-auto">
              <ScoreBadge score={skillMatch.percentage} size="sm" matchedSkills={skillMatch.matchedSkills} missingSkills={skillMatch.missingSkills} />
              <span className="text-xs text-gray-500 font-medium">Skill Match</span>
            </div>
          )}
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-2 tracking-tight">{job.title}</h1>
        <p className="text-lg font-semibold text-primary-600">{job.companyName}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Key details — one fact sheet, not seven boxes */}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
            {job.location && (
              <div>
                <dt className="text-xs text-gray-500">Location</dt>
                <dd className="text-sm font-semibold text-gray-900">{job.location}</dd>
              </div>
            )}
            {job.jobType && (
              <div>
                <dt className="text-xs text-gray-500">Type</dt>
                <dd className="text-sm font-semibold text-gray-900 capitalize">{job.jobType}</dd>
              </div>
            )}
            {(job.workArrangement || job.remoteType) && (
              <div>
                <dt className="text-xs text-gray-500">Work style</dt>
                <dd className="text-sm font-semibold text-gray-900 capitalize">{job.workArrangement || job.remoteType}</dd>
              </div>
            )}
            {job.seniorityLevel && (
              <div>
                <dt className="text-xs text-gray-500">Seniority</dt>
                <dd className="text-sm font-semibold text-gray-900 capitalize">{job.seniorityLevel}</dd>
              </div>
            )}
            {job.salaryMin && (
              <div>
                <dt className="text-xs text-gray-500">Salary</dt>
                <dd className="text-sm font-bold text-success">
                  ${job.salaryMin.toLocaleString()}–${job.salaryMax?.toLocaleString() || "N/A"}
                </dd>
              </div>
            )}
            {job.requiredExperienceYears != null && (
              <div>
                <dt className="text-xs text-gray-500">Experience</dt>
                <dd className="text-sm font-semibold text-gray-900">{job.requiredExperienceYears}+ years</dd>
              </div>
            )}
            {job.jobFunction && (
              <div>
                <dt className="text-xs text-gray-500">Function</dt>
                <dd className="text-sm font-semibold text-gray-900 capitalize">{job.jobFunction}</dd>
              </div>
            )}
          </dl>

          {/* Skill Match Overview */}
          {skillMatch && skillMatch.percentage > 0 && (
            <div className="bg-white rounded-xl border border-[#E8DDD1] shadow-sm">
              <div className="p-6 space-y-6">
                <h2 className="text-base font-semibold text-gray-900">Skill match</h2>
              <div className="flex items-center gap-4 mb-4">
                <ScoreBadge score={skillMatch.percentage} size="lg" matchedSkills={skillMatch.matchedSkills} missingSkills={skillMatch.missingSkills} />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{skillMatch.matchedSkills.length} of {skillMatch.matchedSkills.length + skillMatch.missingSkills.length} required skills matched</p>
                  <p className="text-xs text-gray-500">Based on your most recent resume</p>
                </div>
              </div>
              {skillMatch.matchedSkills.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-500 mb-2">Matched skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {skillMatch.matchedSkills.map((s) => (
                      <span key={s} className="px-2.5 py-0.5 bg-success-50 text-success rounded-full text-xs font-semibold">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {skillMatch.missingSkills.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Missing skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {skillMatch.missingSkills.map((s) => (
                      <span key={s} className="px-2.5 py-0.5 bg-warning-50 text-warning rounded-full text-xs font-semibold">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              </div>
            </div>
          )}

          {/* Posting content — one document: chip sections separated by hairlines */}
          {(job.requiredTechnologies?.length > 0 || job.preferredTechnologies?.length > 0 || job.softSkills?.length > 0 || job.benefitsExtended?.length > 0 || job.description || job.requirements) && (
            <div className="bg-white rounded-xl border border-[#E8DDD1] shadow-sm divide-y divide-[#E8DDD1]">
              {job.requiredTechnologies?.length > 0 && (
                <section className="p-6">
                  <h2 className="text-base font-semibold text-gray-900 mb-4">Required technologies</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {job.requiredTechnologies.map((tech: string) => (
                      <span key={tech} className="px-2.5 py-1 bg-success-50 text-success rounded-full text-xs font-semibold">{tech}</span>
                    ))}
                  </div>
                </section>
              )}

          {/* Preferred Technologies */}
          {job.preferredTechnologies?.length > 0 && (
            <section className="p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Preferred technologies</h2>
              <div className="flex flex-wrap gap-1.5">
                {job.preferredTechnologies.map((tech: string) => (
                  <span key={tech} className="px-2.5 py-1 bg-info-50 text-info rounded-full text-xs font-semibold">{tech}</span>
                ))}
              </div>
            </section>
          )}

          {/* Soft Skills */}
          {job.softSkills?.length > 0 && (
            <section className="p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Soft skills</h2>
              <div className="flex flex-wrap gap-1.5">
                {job.softSkills.map((skill: string) => (
                  <span key={skill} className="px-2.5 py-1 bg-[#F5EDE4] text-gray-700 rounded-full text-xs font-semibold">{skill}</span>
                ))}
              </div>
            </section>
          )}

          {/* Benefits */}
          {job.benefitsExtended?.length > 0 && (
            <section className="p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Benefits</h2>
              <div className="flex flex-wrap gap-1.5">
                {job.benefitsExtended.map((benefit: string) => (
                  <span key={benefit} className="px-2.5 py-1 bg-warning-50 text-warning rounded-full text-xs font-semibold">{benefit}</span>
                ))}
              </div>
            </section>
          )}

          {/* Additional Info */}
          {(job.educationRequired || job.visaSponsorship != null || job.relocationRequired != null || job.relocationAssistance != null || job.hasManagementResponsibilities != null || job.aiMlInvolved != null || job.industry || job.contractDuration || job.startDate) && (
            <section className="p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Additional information</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {job.educationRequired && (
                  <div><span className="text-gray-500">Education:</span> <span className="font-semibold text-gray-900">{job.educationRequired}</span></div>
                )}
                {job.industry && (
                  <div><span className="text-gray-500">Industry:</span> <span className="font-semibold text-gray-900">{job.industry}</span></div>
                )}
                {job.contractDuration && (
                  <div><span className="text-gray-500">Contract:</span> <span className="font-semibold text-gray-900">{job.contractDuration}</span></div>
                )}
                {job.startDate && (
                  <div><span className="text-gray-500">Start Date:</span> <span className="font-semibold text-gray-900">{job.startDate}</span></div>
                )}
                {job.visaSponsorship != null && (
                  <div><span className="text-gray-500">Visa Sponsorship:</span> <span className={`font-semibold ${job.visaSponsorship ? 'text-success' : 'text-gray-900'}`}>{job.visaSponsorship ? 'Yes' : 'No'}</span></div>
                )}
                {job.relocationRequired != null && (
                  <div><span className="text-gray-500">Relocation Required:</span> <span className="font-semibold text-gray-900">{job.relocationRequired ? 'Yes' : 'No'}</span></div>
                )}
                {job.relocationAssistance != null && (
                  <div><span className="text-gray-500">Relocation Assistance:</span> <span className="font-semibold text-gray-900">{job.relocationAssistance ? 'Yes' : 'No'}</span></div>
                )}
                {job.hasManagementResponsibilities != null && (
                  <div><span className="text-gray-500">Management:</span> <span className="font-semibold text-gray-900">{job.hasManagementResponsibilities ? 'Yes' : 'No'}</span></div>
                )}
                {job.aiMlInvolved != null && (
                  <div><span className="text-gray-500">AI/ML Involved:</span> <span className="font-semibold text-gray-900">{job.aiMlInvolved ? 'Yes' : 'No'}</span></div>
                )}
              </div>
            </section>
          )}

          {/* Description */}
          {job.description && (
            <section className="p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Description</h2>
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{job.description}</div>
            </section>
          )}

          {/* Requirements */}
          {job.requirements && (
            <section className="p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Requirements</h2>
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{job.requirements}</div>
            </section>
          )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Primary CTA — lifecycle-aware: continue tracking, or start now */}
          <div className="bg-[#FFF8F0] rounded-xl border border-[#E8DDD1] p-6 space-y-3 shadow-sm">
            {existingApplication ? (
              <>
                <Link to={`/applications/${existingApplication.id}`} className="block">
                  <Button className="w-full" size="lg">Continue This Application →</Button>
                </Link>
                <p className="text-xs text-gray-500 text-center">
                  You're already tracking this job — it's in your pipeline.
                </p>
              </>
            ) : hasResume && resumeId ? (
              hasTailoredResume ? (
                <Link
                  to={`/resumes/${resumeId}`}
                  className="block"
                >
                  <Button className="w-full" size="lg">Edit Tailored Resume</Button>
                </Link>
              ) : (
                <Link
                  to={`/resumes/${resumeId}/tailored?jobId=${job.id}`}
                  className="block"
                >
                  <Button className="w-full" size="lg">Generate Tailored Resume</Button>
                </Link>
              )
            ) : (
              <Link
                to={`/generate-resume?job=${encodeURIComponent(job.title)}&company=${encodeURIComponent(job.companyName)}&jobId=${job.id}`}
                className="block"
              >
                <Button className="w-full" size="lg">Generate Resume for This Job</Button>
              </Link>
            )}

            {/* Secondary actions */}
            <div className="grid grid-cols-2 gap-2">
              {!job.appliedAt && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowApplyModal(true)}
                  disabled={!hasResume}
                >
                  Mark Applied
                </Button>
              )}
              {existingApplication && (
                <Link to={`/applications/${existingApplication.id}`} className="block">
                  <Button variant="secondary" size="sm" className="w-full">View Application</Button>
                </Link>
              )}
              <Button variant="secondary" size="sm" onClick={handleToggleBookmark}>
                {job.isBookmarked ? "★ Bookmarked" : "☆ Bookmark"}
              </Button>
            </div>

            {job.sourceUrl && (
              <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer" className="block">
                <Button variant="ghost" className="w-full" size="sm">View Original Posting ↗</Button>
              </a>
            )}

            {hasResume && resumeId && (
              <Button
                variant="ghost"
                className="w-full"
                size="sm"
                onClick={handleGenerateCoverLetter}
              >
                Generate Cover Letter
              </Button>
            )}
          </div>

          {/* Tags — quiet inline group, no box for four words */}
          {job.tags?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-3">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {job.tags.map((tag: string) => (
                  <span key={tag} className="px-2.5 py-1 bg-[#F5EDE4] text-gray-700 rounded-full text-xs font-semibold">{tag}</span>
                ))}
              </div>
            </div>
          )}

          <div className="text-center text-xs text-gray-400 font-medium">
            {job.postedAt && <p>Posted {new Date(job.postedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</p>}
          </div>
        </div>
      </div>

      {/* Mark Applied Modal */}
      <Modal isOpen={showApplyModal} onClose={() => setShowApplyModal(false)} title="Mark as Applied" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Select the resume you used to apply for <strong>{job.title}</strong> at <strong>{job.companyName}</strong>.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resume</label>
            <select
              value={selectedResumeForApply}
              onChange={(e) => setSelectedResumeForApply(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.jobTitle || r.companyName || r.fileName || 'Untitled Resume'}
                </option>
              ))}
            </select>
          </div>
        </div>
        <ModalFooter actions={[
          { label: "Cancel", variant: "secondary", onClick: () => setShowApplyModal(false) },
          { label: applying ? "Creating..." : "Confirm", onClick: handleApplyConfirm },
        ]} />
      </Modal>

      {/* Cover Letter Modal */}
      <Modal isOpen={showCoverLetter} onClose={() => setShowCoverLetter(false)} title="Cover Letter" size="lg">
        {coverLetterLoading && (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-gray-500">Generating cover letter...</p>
          </div>
        )}
        {coverLetterError && (
          <div className="text-center py-6">
            <p className="text-sm text-red-600 mb-4">{coverLetterError}</p>
            <Button variant="secondary" onClick={handleGenerateCoverLetter}>Retry</Button>
          </div>
        )}
        {coverLetterResult && (
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{coverLetterResult}</div>
            <div className="mt-4 pt-3 border-t border-gray-100">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { navigator.clipboard.writeText(coverLetterResult); toastSuccess("Copied", "Cover letter copied to clipboard"); }}
              >
                Copy to Clipboard
              </Button>
            </div>
          </div>
        )}
        <ModalFooter actions={[{ label: "Close", variant: "secondary", onClick: () => setShowCoverLetter(false) }]} />
      </Modal>
    </PageShell>
  );
}
