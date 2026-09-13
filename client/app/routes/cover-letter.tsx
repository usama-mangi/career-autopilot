import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import type { Resume } from "types";
import { PageShell, PageHeader, Button, Input, Textarea, useToastHelpers, Modal, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Cover Letter" },
  { name: "description", content: "Generate a tailored cover letter based on your resume analysis" },
];

export default function CoverLetter() {
  const { id } = useParams();
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [resume, setResume] = useState<Resume | null>(null);
  const [loadingResume, setLoadingResume] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [coverLetterId, setCoverLetterId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    hiringManager: "",
    additionalContext: "",
  });

  const letterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPending && !isAuthenticated) {
      navigate(`/login`);
    }
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    async function loadResume() {
      if (!id) return;
      try {
        const [data, cachedLetter] = await Promise.all([
          api.resumes.get(id),
          api.resumes.getLatestCoverLetter(id).catch(() => null),
        ]);
        setResume(data);
        setFormData((prev) => ({ ...prev, companyName: data.companyName || prev.companyName }));
        if (cachedLetter) {
          setCoverLetter(cachedLetter.content);
          setCoverLetterId(cachedLetter.id);
          setFormData((prev: any) => ({
            ...prev,
            companyName: cachedLetter.companyName || prev.companyName,
            hiringManager: cachedLetter.hiringManager || prev.hiringManager,
          }));
        }
      } catch (err) {
        console.error("Failed to load resume:", err);
      }
      setLoadingResume(false);
    }
    loadResume();
  }, [id]);

  async function handleGenerate() {
    if (!resume || !id) return;
    setGenerating(true);

    try {
      const result = await api.resumes.coverLetter(id, {
        companyName: formData.companyName || resume.companyName || "",
        hiringManager: formData.hiringManager || undefined,
        jobDescription: formData.additionalContext || undefined,
      } as any);

      setCoverLetter(result.content);
      setCoverLetterId(result.id);
      toastSuccess("Cover letter generated");
    } catch (err) {
      reportError(err, {
        title: "Failed to generate",
        toastError,
        retry: handleGenerate,
      });
    }
    setGenerating(false);
  }

  async function handleCopy() {
    if (!coverLetter) return;
    try {
      await navigator.clipboard.writeText(coverLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      if (letterRef.current) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(letterRef.current);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }

  function formatLetter(text: string) {
    return text
      .split(/\n\n+/)
      .filter(Boolean)
      .map((para, i) => (
        <p key={i} className="mb-4 leading-relaxed text-gray-700">
          {para.trim()}
        </p>
      ));
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Cover Letter Generator"
        subtitle={
          !generating && !coverLetter
            ? "Generate a tailored cover letter based on your resume analysis."
            : generating
              ? "Crafting your cover letter..."
              : "Your cover letter is ready!"
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
          <Link to="/upload" className="Button">
            <Button variant="primary">Upload a Resume</Button>
          </Link>
        </div>
      )}

      {!loadingResume && resume && !coverLetter && !generating && (
        <div className="w-full max-w-xl flex flex-col gap-4">
          <Input
            label="Company Name"
            placeholder="Company Name"
            value={formData.companyName}
            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            required
          />
          <Input
            label="Hiring Manager (optional)"
            placeholder="e.g. John Smith"
            value={formData.hiringManager}
            onChange={(e) => setFormData({ ...formData, hiringManager: e.target.value })}
          />
          <Textarea
            label="Additional Context (optional)"
            placeholder="Anything specific you'd like to highlight..."
            rows={3}
            value={formData.additionalContext}
            onChange={(e) => setFormData({ ...formData, additionalContext: e.target.value })}
          />
          <Button onClick={handleGenerate} disabled={!formData.companyName.trim() || generating}>
            Generate Cover Letter
          </Button>
        </div>
      )}

      {generating && (
        <div className="flex flex-col items-center gap-6 mt-8">
          <img src="/images/resume-scan.gif" className="w-64" />
          <p className="text-sm text-gray-500 animate-pulse">
            Analyzing your resume and tailoring the perfect cover letter...
          </p>
        </div>
      )}

      {coverLetter && !generating && (
        <div className="w-full max-w-4xl flex flex-col gap-6 animate-in fade-in duration-1000">
          <div className="flex flex-row gap-3 justify-end">
            <Button variant="secondary" onClick={handleCopy}>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                />
              </svg>
              {copied ? "Copied!" : "Copy to Clipboard"}
            </Button>
            <Link to={`/resumes/${id}`} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Review
            </Link>
          </div>
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <div className="border-b border-gray-200 pb-4 mb-6">
              <h3 className="text-xl font-semibold text-gray-900">{formData.companyName || resume?.companyName || ""}</h3>
              <p className="text-sm text-gray-500">{resume?.jobTitle || "Position"} — Cover Letter</p>
            </div>
            <div ref={letterRef} className="prose prose-sm max-w-none">
              {formatLetter(coverLetter)}
            </div>
          </div>
          <Button onClick={handleGenerate}>Regenerate</Button>
        </div>
      )}
    </PageShell>
  );
}