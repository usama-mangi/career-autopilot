import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import type { Resume, MultiJdResult } from "types";
import { PageShell, PageHeader, Button, Input, Textarea, ScoreBadge, ScoreCell, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";
import { TrophyIcon } from "~/components/ui/icons";

export const meta = () => [
  { title: "Career Autopilot | Multi-JD Comparison" },
  { name: "description", content: "Compare your resume against multiple job descriptions side by side" },
];

function LocalScoreBadge({ score }: { score: number }) {
  return (
    <span
      className={cn(
        "text-xs font-semibold px-2 py-0.5 rounded-full",
        score > 69
          ? "bg-green-100 text-green-700"
          : score > 49
            ? "bg-yellow-100 text-yellow-700"
            : "bg-red-100 text-red-700",
      )}
    >
      {score}/100
    </span>
  );
}

function LocalScoreCell({ score }: { score: number }) {
  return (
    <div
      className={cn(
        "text-center font-bold text-lg py-2 px-3 rounded-lg",
        score > 69
          ? "bg-green-100 text-green-700"
          : score > 49
            ? "bg-yellow-100 text-yellow-700"
            : "bg-red-100 text-red-700",
      )}
    >
      {score}/100
    </div>
  );
}

export default function MultiJd() {
  const { id } = useParams();
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { error: toastError } = useToastHelpers();

  const [resume, setResume] = useState<Resume | null>(null);
  const [loadingResume, setLoadingResume] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<MultiJdResult | null>(null);
  const [jobEntries, setJobEntries] = useState<{ title: string; description: string }[]>([
    { title: "", description: "" },
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate(`/login`);
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    async function loadResume() {
      if (!id) return;
      try {
        const [data, cachedResult] = await Promise.all([
          api.resumes.get(id),
          api.resumes.getMultiJd(id).catch(() => null),
        ]);
        setResume(data);
        if (cachedResult) setResult(cachedResult);
      } catch (err) {
        console.error("Failed to load resume:", err);
      }
      setLoadingResume(false);
    }
    loadResume();
  }, [id]);

  function addJobEntry() {
    setJobEntries([...jobEntries, { title: "", description: "" }]);
  }

  function removeJobEntry(index: number) {
    setJobEntries(jobEntries.filter((_, i) => i !== index));
  }

  function updateJobEntry(index: number, field: "title" | "description", value: string) {
    const updated = [...jobEntries];
    updated[index] = { ...updated[index], [field]: value };
    setJobEntries(updated);
  }

  function validateForm() {
    const newErrors: Record<string, string> = {};
    const validEntries = jobEntries.filter((j) => j.title.trim());
    if (validEntries.length === 0) newErrors.general = "Add at least one job title";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleCompare() {
    if (!resume || !id) return;
    const valid = jobEntries.filter((j) => j.title.trim());
    if (valid.length === 0) return;
    setGenerating(true);
    setErrors({});
    setResult(null);
    try {
      const parsed = await api.resumes.multiJd(id, { jobEntries: valid });
      setResult(parsed);
    } catch (err) {
      reportError(err, {
        title: "Comparison failed",
        toastError,
        setError: (message) => setErrors({ general: message }),
        retry: handleCompare,
      });
    }
    setGenerating(false);
  }

  const categories = [
    { key: "ATS" as const, label: "ATS" },
    { key: "toneAndStyle" as const, label: "Tone & Style" },
    { key: "content" as const, label: "Content" },
    { key: "structure" as const, label: "Structure" },
    { key: "skills" as const, label: "Skills" },
  ] as const;

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Multi-JD Comparison"
        subtitle={
          !generating && !result
            ? "Compare your resume against multiple job descriptions side by side."
            : generating
              ? "Analyzing across all job descriptions..."
              : "Comparison results are ready!"
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
          <Link to="/upload">
            <Button variant="primary">Upload a Resume</Button>
          </Link>
        </div>
      )}

      {!loadingResume && resume && !result && !generating && (
        <div className="w-full max-w-xl flex flex-col gap-4">
          <Input
            label="Your Job Title"
            placeholder="e.g. Senior Software Engineer"
            value={resume.jobTitle || ""}
            disabled
            className="text-gray-500 bg-gray-50"
          />

          {jobEntries.map((entry, i) => (
            <div key={i} className="p-4 bg-white rounded-xl border border-gray-200 relative">
              {jobEntries.length > 1 && (
                <button
                  onClick={() => removeJobEntry(i)}
                  className="absolute top-3 right-3 size-6 flex items-center justify-center rounded-full bg-red-50 text-red-500 text-xs font-bold hover:bg-red-100 transition-colors cursor-pointer"
                  title="Remove"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <Input
                label={`Job Title ${i + 1}`}
                placeholder="e.g. Senior Software Engineer"
                value={entry.title}
                onChange={(e) => updateJobEntry(i, "title", e.target.value)}
                error={errors[`title-${i}`]}
              />
              <Textarea
                label="Job Description (optional)"
                placeholder="Paste the job description here..."
                rows={4}
                value={entry.description}
                onChange={(e) => updateJobEntry(i, "description", e.target.value)}
              />
            </div>
          ))}

          <button
            onClick={addJobEntry}
            className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors cursor-pointer py-2"
          >
            + Add Another Job
          </button>

          {errors.general && <ErrorBanner error={errors.general} onRetry={handleCompare} className="mb-0" />}

          <Button onClick={handleCompare} disabled={jobEntries.every((j) => !j.title.trim()) || generating}>
            Compare Across Jobs
          </Button>
        </div>
      )}

      {generating && (
        <div className="flex flex-col items-center gap-6 mt-8">
          <img src="/images/resume-scan.gif" className="w-64" alt="" aria-hidden="true" />
          <p className="text-sm text-gray-500 animate-pulse">
            Evaluating your resume against each job description...
          </p>
        </div>
      )}

      {result && !generating && (
        <div className="w-full max-w-6xl flex flex-col gap-6 animate-in fade-in duration-1000">
          <div className="flex flex-row gap-3 justify-end">
            <Link
              to={`/resumes/${id}`}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Review
            </Link>
          </div>

          {/* Best Match Banner */}
          <div className="bg-[#FFF8F0] rounded-2xl p-6 border border-[#E8DDD1]">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-full bg-primary-50 border border-primary-100 flex items-center justify-center flex-shrink-0 text-primary-600">
                <TrophyIcon className="size-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Best Match: {result.bestMatch}</h3>
                <p className="text-sm text-gray-600 mt-1">{result.recommendation}</p>
              </div>
            </div>
          </div>

          {/* Score Comparison Table */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 overflow-x-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Score Comparison</h3>
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 pr-4 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                    Category
                  </th>
                  {result.comparisons.map((c, i) => (
                    <th
                      key={i}
                      className="text-center py-3 px-3 text-sm font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      <span className="truncate max-w-[160px] block" title={c.jobTitle}>
                        {c.jobTitle}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-3 pr-4 font-medium text-gray-700">Overall</td>
                  {result.comparisons.map((c, i) => (
                    <td key={i} className="py-3 px-3">
                      <LocalScoreCell score={c.overallScore} />
                    </td>
                  ))}
                </tr>
                {categories.map((cat) => (
                  <tr key={cat.key} className="border-b border-gray-100">
                    <td className="py-3 pr-4 font-medium text-gray-700">{cat.label}</td>
                    {result.comparisons.map((c, i) => (
                      <td key={i} className="py-3 px-3">
                        <LocalScoreCell score={c[cat.key].score} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detailed Breakdown */}
          <div className="flex flex-col gap-4">
            <h3 className="text-xl font-bold text-gray-900">Detailed Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.comparisons.map((c, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-900">{c.jobTitle}</h4>
                    <LocalScoreBadge score={c.overallScore} />
                  </div>

                  <p className="text-sm text-gray-600">{c.summary}</p>

                  <div className="flex flex-col gap-2 text-sm">
                    {categories.map((cat) => (
                      <div key={cat.key} className="flex justify-between items-center">
                        <span className="text-gray-500">{cat.label}</span>
                        <span
                          className={cn(
                            "font-semibold",
                            c[cat.key].score > 69
                              ? "text-green-600"
                              : c[cat.key].score > 49
                                ? "text-yellow-600"
                                : "text-red-600",
                          )}
                        >
                          {c[cat.key].score}/100
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Tips per category */}
                  <div className="flex flex-col gap-3 pt-2 border-t border-gray-100">
                    {categories.map((cat) => {
                      const tips = c[cat.key].tips;
                      if (!tips || tips.length === 0) return null;
                      const improve = tips.filter((t) => t.type === "improve");
                      if (improve.length === 0) return null;
                      return (
                        <div key={cat.key}>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                            {cat.label} Tips
                          </p>
                          <ul className="flex flex-col gap-1">
                            {improve.map((t, j) => (
                              <li key={j} className="text-xs text-gray-600 flex items-start gap-1.5">
                                <span className="text-red-400 mt-0.5 flex-shrink-0">•</span>
                                <span>
                                  {t.tip}
                                  {"explanation" in t && t.explanation
                                    ? ` — ${(t as { tip: string; explanation: string }).explanation}`
                                    : ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={() => setResult(null)}>Run New Comparison</Button>
        </div>
      )}
    </PageShell>
  );
}