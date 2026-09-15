import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api, getUploadUrl } from "~/lib/api";
import { normalizeFeedback } from "~/lib/utils";
import { useResumeStore } from "~/lib/resume-store";
import { PageShell, Button, Modal, useToastHelpers, CategoryScore, ScoreBadge } from "~/components/ui";
import { ResumePreview } from "~/components/ResumePreview";
import pdfMake from "pdfmake/build/pdfmake";
import pdfMakeVfsFonts from "pdfmake/build/vfs_fonts";
// @ts-ignore
import timesFont from "pdfmake/build/standard-fonts/Times";
import type {
  Resume,
  ResumeVersion,
  Feedback,
  GeneratedResume,
  UserProfile,
  Job,
  TailoredResumeResult,
  ResumeLanguage,
  SharedFeedback,
} from "types";

export const meta = () => [
  { title: "Career Autopilot | Resume View" },
  { name: "description", content: "View your resume" },
];

export default function Resume() {
  const { id } = useParams();
  const { data: session } = useSession();
  const isAuthenticated = !!session;

  const [resume, setResume] = useState<Resume | null>(null);
  const [resumeVersion, setResumeVersion] = useState<ResumeVersion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [generatedContent, setGeneratedContent] = useState<GeneratedResume | null>(null);
  const [textContent, setTextContent] = useState("");
  const [isGenerated, setIsGenerated] = useState(false);
  const [resumeTitle, setResumeTitle] = useState("");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [sharingLoading, setSharingLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [tipFeedback, setTipFeedback] = useState<Record<string, boolean>>({});
  const [showAllFeedback, setShowAllFeedback] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<SharedFeedback | null>(null);

  const navigate = useNavigate();
  const { success: toastSuccess } = useToastHelpers();
  const [isExporting, setIsExporting] = useState(false);
  const storeVersion = useResumeStore((s) => s.resumes[id ?? ""]?.version ?? 0);

  useEffect(() => {
    if (!id) return;

    const loadResume = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const resumeData: Resume = await api.resumes.get(id);
        setResume(resumeData);

        try {
          const versions: ResumeVersion[] = await api.resumes.getResumeVersions(id);
          const primaryVersion = versions.find((v) => v.isPrimary) || versions[0] || null;
          if (primaryVersion) {
            setResumeVersion(primaryVersion);
          }
        } catch {}

        try {
          const profileData = await api.profile.get();
          setUserProfile({
            id: "", userId: "",
            name: profileData.user?.name,
            headline: profileData.user?.headline,
            email: profileData.user?.email,
            phone: profileData.user?.phone,
            location: profileData.user?.location,
            linkedinUrl: profileData.user?.linkedinUrl,
            githubUrl: profileData.user?.githubUrl,
            websiteUrl: profileData.user?.websiteUrl,
            education: [], experience: [], projects: [], skills: [],
            certifications: [], languages: [], onboardingCompleted: false,
            onboardingStep: 0, completionPercentage: 0, createdAt: "", updatedAt: "",
          } as UserProfile);
        } catch {}

        const storeContent = useResumeStore.getState().resumes[id]?.content;
        if (storeContent) {
          setGeneratedContent(storeContent);
          setIsGenerated(true);
          setResumeTitle(resumeData.jobTitle || "");
        } else if (resumeData.generatedContent) {
          const gc = resumeData.generatedContent as GeneratedResume;
          setGeneratedContent(gc);
          setIsGenerated(true);
          setResumeTitle(resumeData.jobTitle || "");
        } else if (resumeData.jobDescription) {
          try {
            const generated: TailoredResumeResult | null = await api.resumes.getTailoredResume(id).catch(() => null);
            if (generated?.tailoredResume) {
              const tr = generated.tailoredResume;
              const normalized: GeneratedResume = {
                ...tr,
                skills: Array.isArray(tr.skills)
                  ? tr.skills.map((s) => (typeof s === "string" ? { name: s } : s))
                  : tr.skills,
                experience: Array.isArray(tr.experience)
                  ? tr.experience.map((e) => ({ ...e, bullets: e.bullets || e.highlights || [] }))
                  : tr.experience,
                projects: Array.isArray(tr.projects)
                  ? tr.projects.map((p) => ({ ...p, bullets: p.bullets || p.highlights || [] }))
                  : tr.projects,
              };
              setGeneratedContent(normalized);
              setTextContent(generated.textContent || "");
              setIsGenerated(true);
              const storedJobId = generated.jobId;
              let title = tr.basics?.headline || resumeData.jobTitle || "";
              if (storedJobId) {
                try {
                  const jobData: Job = await api.jobs.get(storedJobId);
                  if (jobData?.title) title = jobData.title;
                } catch {}
              }
              setResumeTitle(title);
            }
          } catch {}
        }

        if (resumeData.imagePath) {
          try {
            const url = getUploadUrl(resumeData.imagePath);
            setImageUrl(url);
          } catch {}
        }
        if (resumeData.filePath) {
          try {
            const url = getUploadUrl(resumeData.filePath);
            setResumeUrl(url);
          } catch {}
        }

        try {
          const fb: any = await api.resumes.analyze(id);
          setFeedback(normalizeFeedback(fb));
        } catch {}

        try {
          const savedTipFeedback: any = await api.resumes.getTipFeedback(id);
          const feedbackMap: Record<string, boolean> = {};
          if (savedTipFeedback && typeof savedTipFeedback === "object") {
            Object.entries(savedTipFeedback).forEach(([key, value]) => {
              if (typeof value === "boolean") feedbackMap[key] = value;
            });
          }
          setTipFeedback(feedbackMap);
        } catch {}

        try {
          const share: any = await api.resumes.generateShareLink(id);
          if (share.token) {
            setShareUrl(`${window.location.origin}/share/${share.token}`);
          } else if (share.shareUrl) {
            setShareUrl(share.shareUrl);
          }
        } catch {}
      } catch (err) {
        console.error("Failed to load resume:", err);
        setError("Failed to load resume. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadResume();
  }, [id, storeVersion]);

  const handleExportPDF = async () => {
    if (!displayContent) return;
    setIsExporting(true);
    try {
      pdfMake.fonts = {
        Times: {
          normal: "Times-Roman",
          bold: "Times-Bold",
          italics: "Times-Italic",
          bolditalics: "Times-BoldItalic",
        },
      };
      const docDefinition = buildPdfDefinition(displayContent, displayTitle || "Resume", userProfile);
      const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
      const companyPart = resume?.companyName ? sanitize(resume.companyName) : "General";
      const jobPart = resume?.jobTitle ? sanitize(resume.jobTitle) : "Resume";
      const userPart = userProfile?.name ? sanitize(userProfile.name) : "User";
      const versionPart = resumeVersion?.name ? `_${sanitize(resumeVersion.name)}` : "";
      pdfMake.createPdf(docDefinition).download(`${companyPart}_${jobPart}_${userPart}${versionPart}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
    }
    setIsExporting(false);
  };

  const handleShareClick = async () => {
    if (!id) return;
    try {
      setSharingLoading(true);
      if (!shareUrl) {
        const res = await api.resumes.generateShareLink(id);
        const url = `${window.location.origin}/share/${res.shareToken}`;
        setShareUrl(url);
        await navigator.clipboard.writeText(url);
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }
      setShareCopied(true);
      toastSuccess("Copied", "Share link copied to clipboard");
      setTimeout(() => setShareCopied(false), 2000);
    } catch (err) {
      console.error("Share failed:", err);
    } finally {
      setSharingLoading(false);
    }
  };

  const handleRate = async (tipId: string, helpful: boolean) => {
    if (!id) return;
    try {
      await api.resumes.saveTipFeedback(id, { [tipId]: helpful ? "up" : "down" });
      setTipFeedback((prev) => ({ ...prev, [tipId]: helpful }));
    } catch (err) {
      console.error("Failed to rate tip:", err);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm("Delete this resume? This cannot be undone.")) return;
    try {
      await api.resumes.delete(id);
      toastSuccess("Deleted", "Resume deleted");
      navigate("/resumes");
    } catch (err) {
      console.error("Failed to delete resume:", err);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <PageShell>
        <div className="space-y-6">
          <div className="h-10 w-64 bg-gray-100 rounded-lg animate-pulse" />
          <div className="grid lg:grid-cols-12 gap-8">
            <div className="lg:col-span-9">
              <div className="h-[600px] bg-gray-100 rounded-xl animate-pulse" />
            </div>
            <div className="lg:col-span-3 space-y-4">
              <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
              <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  // Error state
  if (error) {
    return (
      <PageShell>
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-base font-medium text-gray-900 mb-1">{error}</p>
          <Button variant="secondary" onClick={() => navigate("/resumes")} className="mt-4">
            Back to Resumes
          </Button>
        </div>
      </PageShell>
    );
  }

  // Not found
  if (!resume) {
    return (
      <PageShell>
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <p className="text-base font-medium text-gray-900 mb-1">Resume not found</p>
          <Button variant="secondary" onClick={() => navigate("/resumes")} className="mt-4">
            Back to Resumes
          </Button>
        </div>
      </PageShell>
    );
  }

  const displayContent = resumeVersion?.content || generatedContent;
  const jobTitle = resume.jobTitle || resumeTitle || resumeVersion?.name || "";
  const displayTitle = jobTitle && resume?.companyName ? `${jobTitle} at ${resume.companyName}` : jobTitle;
  const isAiGenerated = !resumeVersion && generatedContent;

  return (
    <PageShell maxWidth="2xl" padding="lg">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{displayTitle}</h1>
            <p className="mt-1 text-sm text-gray-500 flex items-center gap-2 flex-wrap">
              <span className="truncate">{resume.companyName ? `Target: ${resume.companyName}` : "General Resume"}</span>
              {resumeVersion && (
                <span className="shrink-0 px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full ring-1 ring-green-200">
                  Saved Version
                </span>
              )}
              {isAiGenerated && (
                <span className="shrink-0 px-2 py-0.5 text-xs font-medium bg-[#F5EDE4] text-gray-600 rounded-full ring-1 ring-[#E8DDD1]">
                  AI generated
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {resumeUrl && (
              <a
                href={resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="View Original PDF"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </a>
            )}

            <Button variant="outline" onClick={handleExportPDF} disabled={isExporting} title="Download PDF" className="p-2">
              {isExporting ? (
                <span className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
            </Button>

            <Button variant="outline" onClick={handleShareClick} disabled={sharingLoading} title="Share" className="p-2">
              {shareCopied ? (
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              )}
            </Button>

            <button
              onClick={handleDelete}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-[#78716C] hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
              title="Delete Resume"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>

            <Link
              to={`/resumes/${id}/edit`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Resume
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left: Resume Preview */}
        <div className="lg:col-span-9">
          <div id="resume-preview" className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden p-8 md:p-10 lg:p-12">
            {displayContent && (
              <ResumePreview
                content={displayContent}
                profile={userProfile}
                resumeTitle={displayTitle || ""}
                companyName={resume?.companyName}
              />
            )}

            {!displayContent && (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500">No resume content available</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar — one panel, sections separated by hairlines */}
        <aside className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {/* ATS Analysis */}
          {feedback && (
            <div className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">ATS analysis</h3>
              <div className="space-y-3">
                <CategoryScore label="Overall" score={feedback.overallScore} showBar={false} />
                <CategoryScore label="Keywords" score={feedback.keywordMatchScore ?? 0} showBar={false} />
                <CategoryScore label="Format" score={feedback.formatScore ?? 0} showBar={false} />
              </div>
            </div>
          )}

          {/* Resume Info */}
          <div className="p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Resume info</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500 mb-0.5">Target Role</dt>
                <dd className="font-medium text-gray-900 break-words">{displayTitle}</dd>
              </div>
              {resume.companyName && (
                <div>
                  <dt className="text-gray-500 mb-0.5">Target Company</dt>
                  <dd className="font-medium text-gray-900 break-words">{resume.companyName}</dd>
                </div>
              )}
              {resumeVersion && (
                <div>
                  <dt className="text-gray-500 mb-0.5">Version</dt>
                  <dd className="font-medium text-gray-900">{resumeVersion.name}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500 mb-0.5">Uploaded</dt>
                <dd className="font-medium text-gray-900">{new Date(resume.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
          </div>

          {/* Original File */}
          {resumeUrl && (
            <div className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Original file</h3>
              <a
                href={resumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View Original {(resume.format || "").toUpperCase()}
              </a>
            </div>
          )}

          {/* Shared Feedback */}
          {(resume.sharedFeedbacks ?? []).length > 0 && (
            <div className="p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Feedback ({(resume.sharedFeedbacks ?? []).length})
              </h3>
              <div className="space-y-2">
                {(resume.sharedFeedbacks ?? []).slice(0, 5).map((fb) => (
                  <button
                    key={fb.id}
                    type="button"
                    onClick={() => setSelectedFeedback(fb)}
                    className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">{fb.name}</span>
                      {fb.rating && (
                        <span className="flex items-center gap-0.5 text-xs text-amber-500">
                          {Array.from({ length: fb.rating }).map((_, i) => (
                            <svg key={i} className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{fb.comment}</p>
                  </button>
                ))}
              </div>
              {(resume.sharedFeedbacks ?? []).length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllFeedback(true)}
                  className="mt-3 w-full text-center text-xs text-primary-600 hover:text-primary-700 font-medium py-1"
                >
                  Show all {(resume.sharedFeedbacks ?? []).length}
                </button>
              )}
            </div>
          )}
          </div>
        </aside>
      </div>

      {/* Detailed ATS Feedback */}
      {feedback && (feedback.strengths?.length || feedback.weaknesses?.length || feedback.suggestions?.length) ? (
        <div id="ats-details" className="mt-12">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">ATS Analysis Details</h2>

          <div className="grid gap-6 md:grid-cols-3 mb-8">
            <CategoryScore label="Overall Score" score={feedback.overallScore} />
            <CategoryScore label="Keyword Match" score={feedback.keywordMatchScore ?? 0} />
            <CategoryScore label="Format Score" score={feedback.formatScore ?? 0} />
          </div>

          {feedback.strengths && feedback.strengths.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Strengths</h3>
              <ul className="space-y-2">
                {(feedback.strengths ?? []).map((s: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {feedback.weaknesses && feedback.weaknesses.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Areas to improve</h3>
              <ul className="space-y-2">
                {(feedback.weaknesses ?? []).map((w: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {feedback.suggestions && feedback.suggestions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Suggestions</h3>
              <ul className="space-y-3">
                {(feedback.suggestions ?? []).map((s: string, i: number) => (
                  <li key={i} className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">{s}</p>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        onClick={() => handleRate(`${id}-suggestion-${i}`, true)}
                        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md transition-colors ${
                          tipFeedback[`${id}-suggestion-${i}`] === true
                            ? "bg-green-100 text-green-700"
                            : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                        }`}
                        disabled={tipFeedback[`${id}-suggestion-${i}`] !== undefined}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                        </svg>
                        Helpful
                      </button>
                      <button
                        onClick={() => handleRate(`${id}-suggestion-${i}`, false)}
                        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md transition-colors ${
                          tipFeedback[`${id}-suggestion-${i}`] === false
                            ? "bg-red-100 text-red-700"
                            : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                        }`}
                        disabled={tipFeedback[`${id}-suggestion-${i}`] !== undefined}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                        </svg>
                        Not helpful
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      {/* All Feedback Modal */}
      <Modal isOpen={showAllFeedback} onClose={() => setShowAllFeedback(false)} title="All Feedback" size="md">
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {(resume.sharedFeedbacks ?? []).map((fb) => (
            <button
              key={fb.id}
              type="button"
              onClick={() => { setShowAllFeedback(false); setSelectedFeedback(fb); }}
              className="w-full text-left p-4 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-900">{fb.name}</span>
                {fb.rating && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-500">
                    {Array.from({ length: fb.rating }).map((_, i) => (
                      <svg key={i} className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                    {Array.from({ length: 5 - fb.rating }).map((_, i) => (
                      <svg key={`empty-${i}`} className="w-3 h-3 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </span>
                )}
                <span className="text-xs text-gray-400 ml-auto">{new Date(fb.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">{fb.comment}</p>
            </button>
          ))}
        </div>
      </Modal>

      {/* Single Feedback Modal */}
      <Modal isOpen={!!selectedFeedback} onClose={() => setSelectedFeedback(null)} title="Feedback" size="md">
        {selectedFeedback && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm">
                {selectedFeedback.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-gray-900">{selectedFeedback.name}</p>
                <p className="text-xs text-gray-500">{new Date(selectedFeedback.createdAt).toLocaleDateString()}</p>
              </div>
              {selectedFeedback.rating && (
                <span className="ml-auto flex items-center gap-0.5 text-amber-500">
                  {Array.from({ length: selectedFeedback.rating }).map((_, i) => (
                    <svg key={i} className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  {Array.from({ length: 5 - selectedFeedback.rating }).map((_, i) => (
                    <svg key={`empty-${i}`} className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{selectedFeedback.comment}</p>
          </div>
        )}
      </Modal>
    </PageShell>
  );
}

function buildPdfDefinition(content: GeneratedResume, title: string, profile: UserProfile | null): any {
  const name = content.basics?.name || (content as any).name || profile?.name || title;
  const headline = content.basics?.headline || (content as any).headline || profile?.headline || "";
  const email = content.basics?.email || (content as any).email || profile?.email || "";
  const phone = content.basics?.phone || (content as any).phone || profile?.phone || "";
  const location = content.basics?.location || (content as any).location || profile?.location || "";
  const linkedin = content.basics?.linkedin || (content as any).linkedin || profile?.linkedinUrl || "";
  const github = content.basics?.github || (content as any).github || profile?.githubUrl || "";
  const website = content.basics?.website || (content as any).website || profile?.websiteUrl || "";
  const summary = content.basics?.summary || (content as any).summary || "";
  const experience = content.experience || [];
  const education = content.education || [];
  const skills = content.skills || [];
  const projects = content.projects || [];
  const certifications = content.certifications || [];
  const languages = content.languages || [];
  const awards = content.awards || [];
  const publications = content.publications || [];
  const volunteer = content.volunteer || [];
  const references = content.references || [];
  const customSections = content.customSections || [];

  const F = "Times";
  const NAME = 17;
  const HL = 9;
  const CONTACT = 8;
  const SECTION = 10;
  const BODY = 9;
  const ITEM_TITLE = 10;
  const DATE = 8;
  const SMALL = 8;

  const C800 = "#1f2937";
  const C700 = "#374151";
  const C600 = "#4b5563";
  const C500 = "#6b7280";

  const fmtDate = (d: string) => {
    if (!d) return "";
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };
  const formatDate = fmtDate;
  const fmtRange = (s: string, e?: string, cur?: boolean) => {
    const start = fmtDate(s);
    let end = cur ? "Present" : fmtDate(e || "");
    if (start && !end) end = "Present";
    if (!start && !end) return "";
    return `${start} – ${end}`;
  };

  const section = (text: string): any => ({
    table: {
      widths: ["*"],
      body: [[{ text: text.toUpperCase(), bold: true, fontSize: SECTION, font: F, color: "#000000" }]],
    },
    layout: {
      hLineWidth: (i: number) => i === 0 ? 0 : 0.5,
      vLineWidth: () => 0,
      paddingBottom: () => 3,
    },
    margin: [0, 14, 0, 10],
  });

  const body: any[] = [];

  body.push({
    text: name.toUpperCase(),
    fontSize: NAME,
    bold: true,
    font: F,
    characterSpacing: 1,
    alignment: "center",
    margin: [0, 0, 0, 2],
  });

  if (headline) {
    body.push({
      text: headline,
      fontSize: HL,
      font: F,
      color: C700,
      alignment: "center",
      margin: [0, 0, 0, 4],
    });
  }

  const contactItems: Array<{ text: string; link?: string }> = [];
  if (location) contactItems.push({ text: location });
  if (phone) contactItems.push({ text: phone, link: `tel:${phone}` });
  if (email) contactItems.push({ text: email, link: `mailto:${email}` });
  if (linkedin) contactItems.push({ text: linkedin.replace(/^https?:\/\//, ""), link: linkedin.startsWith("http") ? linkedin : `https://${linkedin}` });
  if (github) contactItems.push({ text: github.replace(/^https?:\/\//, ""), link: github.startsWith("http") ? github : `https://${github}` });
  if (website) contactItems.push({ text: website.replace(/^https?:\/\//, ""), link: website.startsWith("http") ? website : `https://${website}` });

  if (contactItems.length) {
    const contactText: any[] = [];
    contactItems.forEach((item, i) => {
      if (i > 0) contactText.push({ text: "  |  ", fontSize: CONTACT, font: F, color: C600 });
      if (item.link) {
        contactText.push({ text: item.text, fontSize: CONTACT, font: F, color: C600, link: item.link });
      } else {
        contactText.push({ text: item.text, fontSize: CONTACT, font: F, color: C600 });
      }
    });
    body.push({ text: contactText, alignment: "center", margin: [0, 0, 0, 10] } as any);
  }

  if (summary) {
    body.push(section("Professional Summary"));
    body.push({ text: summary, fontSize: BODY, font: F, lineHeight: 1.6, color: C800, margin: [0, 0, 0, 4] });
  }

  if (experience.length) {
    body.push(section("Professional Experience"));
    for (const exp of experience) {
      const dateRange = fmtRange(exp.startDate, exp.endDate, exp.current);
      const titleParts: any[] = [
        { text: exp.title, fontSize: ITEM_TITLE, bold: true, font: F, color: "#000000" },
      ];
      if (exp.company) titleParts.push({ text: `, ${exp.company}`, fontSize: ITEM_TITLE, font: F, color: C700 });
      if (exp.location) titleParts.push({ text: ` — ${exp.location}`, fontSize: ITEM_TITLE, font: F, color: C500 });

      body.push({
        columns: [
          { text: titleParts, width: "*" },
          ...(dateRange ? [{ text: dateRange, width: "auto", fontSize: DATE, font: F, color: C500, alignment: "right" }] : []),
        ],
        margin: [0, 4, 0, 2],
      } as any);

      if (exp.description) {
        body.push({ text: exp.description, fontSize: BODY, font: F, lineHeight: 1.6, color: C800, margin: [0, 1, 0, 2] });
      }

      const bullets = exp.bullets || exp.highlights || [];
      const validBullets = bullets.filter(Boolean);
      if (validBullets.length) {
        body.push({
          ul: validBullets.map((b: string) => ({ text: b, fontSize: BODY, font: F, lineHeight: 1.6, color: C800 })),
          margin: [8, 1, 0, 4],
          listType: "bullet",
        } as any);
      }

      if (exp.technologies && exp.technologies.length > 0) {
        body.push({
          text: [
            { text: "Technologies: ", fontSize: SMALL, font: F, bold: true, color: C500 },
            { text: exp.technologies.join(", "), fontSize: SMALL, font: F, color: C500 },
          ],
          margin: [0, 1, 0, 4],
        });
      }
    }
  }

  if (education.length) {
    body.push(section("Education"));
    for (const edu of education) {
      const dateRange = fmtRange(edu.startDate || "", edu.endDate || "");
      const titleParts: any[] = [
        { text: `${edu.degree}${edu.field ? ` in ${edu.field}` : ""}`, fontSize: ITEM_TITLE, bold: true, font: F, color: "#000000" },
      ];
      if (edu.school) titleParts.push({ text: `, ${edu.school}`, fontSize: ITEM_TITLE, font: F, color: C700 });
      if (edu.location) titleParts.push({ text: ` — ${edu.location}`, fontSize: ITEM_TITLE, font: F, color: C500 });

      body.push({
        columns: [
          { text: titleParts, width: "*" },
          ...(dateRange ? [{ text: dateRange, width: "auto", fontSize: DATE, font: F, color: C500, alignment: "right" }] : []),
        ],
        margin: [0, 4, 0, 2],
      });

      if (edu.gpa) {
        body.push({ text: `GPA: ${edu.gpa}`, fontSize: BODY, font: F, color: C600, margin: [8, 0, 0, 1] });
      }
      if (edu.honors?.length) {
        body.push({ text: `Honors: ${edu.honors.join(", ")}`, fontSize: BODY, font: F, color: C600, margin: [8, 0, 0, 1] });
      }
      if (edu.coursework?.length) {
        body.push({ text: `Relevant Coursework: ${edu.coursework.join(", ")}`, fontSize: BODY, font: F, color: C600, margin: [8, 0, 0, 1] });
      }
    }
  }

  if (skills.length) {
    body.push(section("Skills"));
    if (skills.length > 0 && typeof skills[0] === "string") {
      body.push({
        text: skills.join(", "),
        fontSize: BODY,
        font: F,
        lineHeight: 1.6,
        color: C800,
        margin: [0, 0, 0, 4],
      });
    } else {
      const categorized: Record<string, string[]> = {};
      for (const s of skills) {
        const n = typeof s === "string" ? s : s.name;
        if (!n) continue;
        const cat = (typeof s === "object" && s.category) || "Technical Skills";
        if (!categorized[cat]) categorized[cat] = [];
        categorized[cat].push(n);
      }
      for (const [cat, names] of Object.entries(categorized)) {
        body.push({
          text: [
            { text: `${cat}: `, bold: true, fontSize: BODY, font: F, color: C800 },
            { text: names.join(", "), fontSize: BODY, font: F, color: C800 },
          ],
          margin: [0, 0, 0, 2],
        });
      }
    }
  }

  if (projects.length) {
    body.push(section("Projects"));
    for (const proj of projects) {
      const dateRange = fmtRange(proj.startDate || "", proj.endDate || "");
      const titleParts: any[] = [
        { text: proj.name, fontSize: ITEM_TITLE, bold: true, font: F, color: "#000000" },
      ];
      if (proj.url) titleParts.push({ text: ` (${proj.url.replace(/^https?:\/\//, "")})`, fontSize: DATE, font: F, color: C500 });

      body.push({
        columns: [
          { text: titleParts, width: "*" },
          ...(dateRange ? [{ text: dateRange, width: "auto", fontSize: DATE, font: F, color: C500, alignment: "right" }] : []),
        ],
        margin: [0, 4, 0, 2],
      });

      if (proj.description) {
        body.push({ text: proj.description, fontSize: BODY, font: F, lineHeight: 1.6, color: C800, margin: [0, 1, 0, 2] });
      }

      const projBullets = proj.bullets || proj.highlights || [];
      const validBullets = projBullets.filter(Boolean);
      if (validBullets.length) {
        body.push({
          ul: validBullets.map((b: string) => ({ text: b, fontSize: BODY, font: F, lineHeight: 1.6, color: C800 })),
          margin: [8, 1, 0, 2],
          listType: "bullet",
        });
      }

      if (proj.technologies && proj.technologies.length > 0) {
        body.push({
          text: [
            { text: "Technologies: ", fontSize: SMALL, font: F, bold: true, color: C500 },
            { text: proj.technologies.join(", "), fontSize: SMALL, font: F, color: C500 },
          ],
          margin: [0, 1, 0, 4],
        });
      }
    }
  }

  if (certifications.length) {
    body.push(section("Certifications"));
    for (const cert of certifications) {
      const titleParts: any[] = [
        { text: cert.name, fontSize: BODY, bold: true, font: F, color: "#000000" },
        { text: ` — ${cert.issuer}`, fontSize: BODY, font: F, color: C600 },
      ];
      body.push({
        columns: [
          { text: titleParts, width: "*" },
          { text: formatDate(cert.date || ""), width: "auto", fontSize: DATE, font: F, color: C500, alignment: "right" },
        ],
        margin: [0, 2, 0, 2],
      });
    }
  }

  if (languages.length) {
    body.push(section("Languages"));
    body.push({
      text: languages.map((l: ResumeLanguage) => `${l.name} (${l.proficiency})`).join(", "),
      fontSize: BODY,
      font: F,
      color: C800,
      margin: [0, 0, 0, 4],
    });
  }

  if (awards.length) {
    body.push(section("Awards & Honors"));
    for (const award of awards) {
      const titleParts: any[] = [
        { text: award.title, fontSize: BODY, bold: true, font: F, color: "#000000" },
      ];
      if (award.issuer) titleParts.push({ text: ` — ${award.issuer}`, fontSize: BODY, font: F, color: C600 });
      body.push({
        columns: [
          { text: titleParts, width: "*" },
          { text: formatDate(award.date || ""), width: "auto", fontSize: DATE, font: F, color: C500, alignment: "right" },
        ],
        margin: [0, 2, 0, 2],
      });
    }
  }

  if (publications.length) {
    body.push(section("Publications"));
    for (const pub of publications) {
      const titleParts: any[] = [
        { text: `\u201c${pub.title}\u201d`, fontSize: BODY, italics: true, font: F, color: C800 },
      ];
      if (pub.publisher) titleParts.push({ text: ` — ${pub.publisher}`, fontSize: BODY, font: F, color: C600 });
      body.push({
        columns: [
          { text: titleParts, width: "*" },
          { text: formatDate(pub.date || ""), width: "auto", fontSize: DATE, font: F, color: C500, alignment: "right" },
        ],
        margin: [0, 2, 0, 2],
      });
    }
  }

  if (volunteer.length) {
    body.push(section("Volunteer Experience"));
    for (const vol of volunteer) {
      const dateRange = fmtRange(vol.startDate || "", vol.endDate || "");
      body.push({
        columns: [
          {
            text: [
              { text: vol.role || "Volunteer", fontSize: ITEM_TITLE, bold: true, font: F, color: "#000000" },
              { text: `, ${vol.organization}`, fontSize: ITEM_TITLE, font: F, color: C700 },
            ],
            width: "*",
          },
          ...(dateRange ? [{ text: dateRange, width: "auto", fontSize: DATE, font: F, color: C500, alignment: "right" }] : []),
        ],
        margin: [0, 4, 0, 2],
      });

      if (vol.description) {
        body.push({ text: vol.description, fontSize: BODY, font: F, lineHeight: 1.6, color: C800, margin: [0, 1, 0, 2] });
      }

      if (vol.highlights && vol.highlights.length) {
        body.push({
          ul: vol.highlights.map((h: string) => ({ text: h, fontSize: BODY, font: F, lineHeight: 1.6, color: C800 })),
          margin: [8, 1, 0, 4],
          listType: "bullet",
        });
      }
    }
  }

  if (references.length) {
    body.push(section("References"));
    for (const ref of references) {
      const parts: any[] = [
        { text: `${ref.name}, ${ref.title}, ${ref.company}`, fontSize: BODY, font: F, color: C800 },
      ];
      if (ref.email) parts.push({ text: ` — ${ref.email}`, fontSize: BODY, font: F, color: C500 });
      body.push({ text: parts, margin: [0, 2, 0, 2] });
    }
  }

  if (customSections.length) {
    for (const cs of customSections) {
      body.push(section(cs.title || "Custom Section"));
      const lines = (cs.content || "").split("\n").filter(Boolean);
      for (const line of lines) {
        body.push({ text: line, fontSize: BODY, font: F, lineHeight: 1.6, color: C800, margin: [0, 0, 0, 2] });
      }
    }
  }

  return {
    content: body,
    defaultStyle: { font: F, fontSize: BODY },
    pageMargins: [36, 36, 36, 36],
  };
}
