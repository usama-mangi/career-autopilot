import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import type { Resume, SkillGapResult } from "types";
import { PageShell, PageHeader, Button, Input, Textarea, Card, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Skill Gap Analysis" },
  { name: "description", content: "Identify skill gaps and get actionable learning recommendations" },
];

const importanceConfig = {
  critical: { label: "Critical", class: "bg-red-100 text-red-700 border-red-200" },
  important: { label: "Important", class: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  "nice-to-have": { label: "Nice to Have", class: "bg-blue-100 text-blue-700 border-blue-200" },
};

const difficultyConfig = {
  beginner: { label: "Beginner", class: "bg-green-100 text-green-700" },
  intermediate: { label: "Intermediate", class: "bg-yellow-100 text-yellow-700" },
  advanced: { label: "Advanced", class: "bg-red-100 text-red-700" },
};

const typeLabels: Record<string, string> = {
  course: "📚 Course",
  article: "📄 Article",
  project: "🛠️ Project",
  certification: "🎓 Certification",
  documentation: "📖 Documentation",
};

export default function SkillGap() {
  const { id } = useParams();
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { error: toastError } = useToastHelpers();

  const [resume, setResume] = useState<Resume | null>(null);
  const [loadingResume, setLoadingResume] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<SkillGapResult | null>(null);
  const [error, setError] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate(`/login`);
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    async function loadResume() {
      if (!id) return;
      try {
        const [data, cachedResult] = await Promise.all([
          api.resumes.get(id),
          api.resumes.getSkillGap(id).catch(() => null),
        ]);
        setResume(data);
        setJobDescription(data.jobDescription || "");
        if (cachedResult) setResult(cachedResult);
      } catch (err) {
        console.error("Failed to load resume:", err);
      }
      setLoadingResume(false);
    }
    loadResume();
  }, [id]);

  async function handleAnalyze() {
    if (!resume || !id) return;
    setGenerating(true);
    setError("");
    setResult(null);
    try {
      const parsed = await api.resumes.skillGap(id, { jobDescription: jobDescription || undefined });
      setResult(parsed);
    } catch (err) {
      reportError(err, {
        title: "Analysis failed",
        toastError,
        setError,
        retry: handleAnalyze,
      });
    }
    setGenerating(false);
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Skill Gap Analysis"
        subtitle={
          !generating && !result
            ? "Identify missing skills and get actionable learning recommendations."
            : generating
              ? "Analyzing skill gaps..."
              : "Your skill gap analysis is ready!"
        }
      />

      {loadingResume && (
        <div className="flex flex-col items-center justify-center py-12">
          <img src="/images/resume-scan-2.gif" className="w-[200px]" />
        </div>
      )}

      {!loadingResume && !resume && (
        <div className="flex flex-col items-center gap-4 mt-8">
          <p className="text-lg text-gray-500">Resume not found.</p>
          <Link to="/upload"><Button>Upload a Resume</Button></Link>
        </div>
      )}

      {!loadingResume && resume && !result && !generating && (
        <div className="w-full max-w-xl flex flex-col gap-4">
          <Input
            label="Job Title"
            value={resume.jobTitle || ""}
            disabled
            className="text-gray-500 bg-gray-50"
          />
          <Textarea
            label="Job Description (optional)"
            placeholder="Paste the job description here..."
            rows={6}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          />
          <Button onClick={handleAnalyze}>Analyze Skill Gaps</Button>
        </div>
      )}

      {generating && (
        <div className="flex flex-col items-center gap-6 mt-8">
          <img src="/images/resume-scan.gif" className="w-64" />
          <p className="text-sm text-gray-500 animate-pulse">Comparing your skills against the job requirements...</p>
        </div>
      )}

      {error && <ErrorBanner error={error} onRetry={handleAnalyze} className="w-full max-w-4xl" />}

      {result && !generating && (
        <div className="w-full max-w-4xl flex flex-col gap-6 animate-in fade-in duration-1000">
          <div className="flex flex-row gap-3 justify-end">
            <Link to={`/resumes/${id}`} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Back to Review
            </Link>
          </div>

          <Card>
            <div className="flex flex-row items-center gap-6 mb-6">
              <div className="flex flex-col items-center">
                <div className={cn("size-24 rounded-full flex items-center justify-center text-2xl font-bold", result.totalScore > 70 ? "bg-green-100 text-green-700" : result.totalScore > 40 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700")}>
                  {result.totalScore}%
                </div>
                <p className="text-xs text-gray-500 mt-1">Skill Match</p>
              </div>
              <div className="flex-1"><p className="text-gray-700 leading-relaxed">{result.summary}</p></div>
            </div>
            {result.presentSkills.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">✅ Skills You Have</h3>
                <div className="flex flex-wrap gap-2">
                  {result.presentSkills.map((skill) => (
                    <span key={skill} className="px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm font-medium">{skill}</span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {result.missingSkills.length > 0 && (
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-semibold text-gray-900">🎯 Skills to Develop</h3>
              {result.missingSkills.map((item, i) => (
                <Card key={item.skill}>
                  <div className="flex flex-row items-center gap-3 mb-4">
                    <span className="text-lg font-semibold text-gray-900">{i + 1}. {item.skill}</span>
                    <span className={cn("text-xs font-medium px-2.5 py-0.5 rounded-full border", importanceConfig[item.importance].class)}>{importanceConfig[item.importance].label}</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {item.recommendations.map((rec, j) => (
                      <div key={j} className="flex flex-col gap-1.5 p-4 bg-gray-50 rounded-xl">
                        <div className="flex flex-row items-center gap-2">
                          <span className="text-sm font-medium text-gray-800">{typeLabels[rec.type] || rec.type}</span>
                          <span className={cn("text-xs px-2 py-0.5 rounded-full", difficultyConfig[rec.difficulty].class)}>{difficultyConfig[rec.difficulty].label}</span>
                          {rec.duration && <span className="text-xs text-gray-400 ml-auto">{rec.duration}</span>}
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{rec.title}</p>
                        <p className="text-sm text-gray-600">{rec.description}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}

          <Button onClick={handleAnalyze}>Re-analyze</Button>
        </div>
      )}
    </PageShell>
  );
}