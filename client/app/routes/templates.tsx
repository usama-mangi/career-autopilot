import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import type { Resume, ResumeTemplateSuggestionsResult } from "types";
import { PageShell, PageHeader, Button, Card, ScoreBadge, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | ATS-Friendly Templates" },
  { name: "description", content: "Get ATS-friendly resume template recommendations based on your profile" },
];

export default function Templates() {
  const { id } = useParams();
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { error: toastError } = useToastHelpers();

  const [resume, setResume] = useState<Resume | null>(null);
  const [loadingResume, setLoadingResume] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<ResumeTemplateSuggestionsResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate(`/login`);
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    async function loadResume() {
      if (!id) return;
      try {
        const [data, cachedResult] = await Promise.all([
          api.resumes.get(id),
          api.resumes.getTemplateSuggestions(id).catch(() => null),
        ]);
        setResume(data);
        setLoadingResume(false);
        if (cachedResult) {
          setResult(cachedResult);
        } else {
          setGenerating(true);
          try {
            const parsed = await api.resumes.templateSuggestions(id);
            setResult(parsed);
          } catch (err) {
            reportError(err, {
              title: "Suggestions failed",
              toastError,
              setError,
            });
          }
          setGenerating(false);
        }
      } catch (err) {
        console.error("Failed to load resume:", err);
        setLoadingResume(false);
      }
    }
    loadResume();
  }, [id]);

  async function handleAnalyze() {
    if (!resume || !id) return;
    setGenerating(true);
    setError("");
    setResult(null);
    try {
      const parsed = await api.resumes.templateSuggestions(id);
      setResult(parsed);
    } catch (err) {
      reportError(err, {
        title: "Suggestions failed",
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
        title="ATS-Friendly Templates"
        subtitle={
          !generating && !result
            ? "Get personalized resume template recommendations based on your profile."
            : generating
              ? "Analyzing your resume for the best template match..."
              : "Your template recommendations are ready!"
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

      {generating && (
        <div className="flex flex-col items-center gap-6 mt-8">
          <img src="/images/resume-scan.gif" className="w-64" />
          <p className="text-sm text-gray-500 animate-pulse">Evaluating your resume and finding the best template styles...</p>
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
                <div className={cn("size-24 rounded-full flex items-center justify-center text-2xl font-bold", result.currentTemplateScore > 70 ? "bg-green-100 text-green-700" : result.currentTemplateScore > 40 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700")}>
                  {result.currentTemplateScore}
                </div>
                <p className="text-xs text-gray-500 mt-1">Current Score</p>
              </div>
              <div className="flex-1">
                <p className="text-gray-700 leading-relaxed">{result.currentTemplateAnalysis}</p>
              </div>
            </div>
          </Card>

          <h3 className="text-xl font-semibold text-gray-900">Recommended Templates</h3>

          {result.suggestions.map((template, i) => (
            <Card key={template.name}>
              <div className="flex flex-row items-start justify-between mb-4">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">{i + 1}. {template.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                </div>
                <div className="flex flex-col items-center ml-4">
                  <div className={cn("size-16 rounded-full flex items-center justify-center text-lg font-bold", template.atsScore > 70 ? "bg-green-100 text-green-700" : template.atsScore > 40 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700")}>
                    {template.atsScore}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">ATS Score</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm font-medium text-gray-500 mb-2">Best For</p>
                <div className="flex flex-wrap gap-2">
                  {template.bestFor.map((item) => (
                    <span key={item} className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs font-medium">{item}</span>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm font-medium text-gray-500 mb-2">Key Features</p>
                <ul className="list-disc list-inside space-y-1">
                  {template.keyFeatures.map((feature) => (
                    <li key={feature} className="text-sm text-gray-700">{feature}</li>
                  ))}
                </ul>
              </div>

              {template.sectionOrder.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-500 mb-2">Recommended Section Order</p>
                  <div className="flex flex-wrap gap-1.5">
                    {template.sectionOrder.map((section, j) => (
                      <span key={section} className="flex items-center gap-1 text-xs">
                        <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md font-medium">{section}</span>
                        {j < template.sectionOrder.length - 1 && <span className="text-gray-300">→</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Design Tips</p>
                <ul className="space-y-1.5">
                  {template.designTips.map((tip) => (
                    <li key={tip} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          ))}

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">General Customization Tips</h3>
            <ul className="space-y-2">
              {result.customizationTips.map((tip) => (
                <li key={tip} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-success mt-0.5" aria-hidden="true">✓</span>
                  {tip}
                </li>
              ))}
            </ul>
          </Card>

          <div className="bg-[#FFF8F0] rounded-2xl p-6 border border-[#E8DDD1]">
            <p className="text-sm text-gray-700 leading-relaxed">{result.summary}</p>
          </div>

          <Button onClick={handleAnalyze}>Re-analyze</Button>
        </div>
      )}
    </PageShell>
  );
}
