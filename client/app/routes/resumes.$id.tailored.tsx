import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import type { Resume } from "types";
import { PageShell, PageHeader, Button, Textarea, Input, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Tailored Resume Builder" },   { name: "description", content: "Tailor a resume to a specific job posting" },
];

export default function TailoredResume() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get("jobId");
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [resume, setResume] = useState<Resume | null>(null);
  const [loadingResume, setLoadingResume] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [targetRole, setTargetRole] = useState("");

  useEffect(() => {
    if (!isPending && !isAuthenticated) {
      navigate("/login");
    }
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    async function loadResume() {
      if (!id) return;
      try {
        const data = await api.resumes.get(id);
        setResume(data);

        // If navigating from a job detail page, fetch job data and pre-fill the form
        if (jobId) {
          try {
            const job = await api.jobs.get(jobId);
            if (job?.description) setJobDescription(job.description);
            if (job?.title) setTargetRole(job.title);
          } catch {
            // Job fetch is optional — user can still type manually
          }
        }
      } catch (err) {
        console.error("Failed to load resume:", err);
      }
      setLoadingResume(false);
    }
    loadResume();
  }, [id, jobId]);

  async function handleGenerate() {
    if (!resume || !id) return;
    if (!jobDescription.trim()) return;
    setGenerating(true);
    setError("");

    try {
      const result = await api.resumes.generateTailoredResume(id, { jobDescription, targetRole, jobId: jobId || undefined });
      toastSuccess("Resume tailored", "Your customized resume is ready");
      // Navigate to the NEW tailored resume detail page
      const newResumeId = result.newResumeId;
      if (newResumeId) {
        navigate(`/resumes/${newResumeId}`);
      } else {
        navigate(`/resumes/${id}`);
      }
    } catch (err) {
      reportError(err, {
        title: "Generation failed",
        toastError,
        setError,
        retry: handleGenerate,
      });
    }
    setGenerating(false);
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Tailored Resume Builder"
        subtitle={
          generating
            ? "Tailoring your resume for the target role..."
            : "Customize your resume for a specific job: matched keywords move up, missing ones get flagged."
        }
      />

      {loadingResume && (
        <div className="flex flex-col items-center justify-center">
          <img src="/images/resume-scan-2.gif" className="w-[200px]" />
        </div>
      )}

      {!loadingResume && !resume && (
        <div className="flex flex-col items-center gap-4 mt-8">
          <p className="text-lg text-gray-500">Resume not found.</p>
          <Link to="/upload"><Button variant="primary">Upload a Resume</Button></Link>
        </div>
      )}

      {!loadingResume && resume && !generating && (
        <div className="w-full max-w-xl flex flex-col gap-4">
          <Input
            label="Target Role"
            placeholder="e.g. Senior Software Engineer"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
          />
          <Textarea
            label="Job Description"
            placeholder="Paste the job description here..."
            rows={8}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          />
          <Button onClick={handleGenerate} disabled={!jobDescription.trim() || generating}>
            Generate Tailored Resume
          </Button>
        </div>
      )}

      {generating && (
        <div className="flex flex-col items-center gap-6 mt-8">
          <img src="/images/resume-scan.gif" className="w-64" alt="" aria-hidden="true" />
          <p className="text-sm text-gray-500 animate-pulse">
            Analyzing the job description and customizing your resume...
          </p>
        </div>
      )}

      {error && <ErrorBanner error={error} onRetry={handleGenerate} className="w-full max-w-4xl" />}
    </PageShell>
  );
}
