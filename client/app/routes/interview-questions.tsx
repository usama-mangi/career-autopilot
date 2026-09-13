import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import type { Resume, InterviewQuestionsResult, InterviewQuestion } from "types";
import { PageShell, PageHeader, Button, Input, Textarea, Card, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Interview Questions" },
  { name: "description", content: "Generate realistic interview questions tailored to your resume" },
];

const categoryConfig = {
  behavioral: { label: "Behavioral", class: "bg-purple-100 text-purple-700 border-purple-200", icon: "💬" },
  technical: { label: "Technical", class: "bg-blue-100 text-blue-700 border-blue-200", icon: "⚙️" },
  "role-specific": { label: "Role-Specific", class: "bg-orange-100 text-orange-700 border-orange-200", icon: "🎯" },
  situational: { label: "Situational", class: "bg-teal-100 text-teal-700 border-teal-200", icon: "🧠" },
};

const difficultyConfig = {
  easy: { label: "Easy", class: "bg-green-100 text-green-700" },
  medium: { label: "Medium", class: "bg-yellow-100 text-yellow-700" },
  hard: { label: "Hard", class: "bg-red-100 text-red-700" },
};

export default function InterviewQuestions() {
  const { id } = useParams();
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { error: toastError } = useToastHelpers();

  const [resume, setResume] = useState<Resume | null>(null);
  const [loadingResume, setLoadingResume] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<InterviewQuestionsResult | null>(null);
  const [error, setError] = useState("");
  const [questionCount, setQuestionCount] = useState(8);
  const [focusAreas, setFocusAreas] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate(`/login`);
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    async function loadResume() {
      if (!id) return;
      try {
        const [data, cachedResult] = await Promise.all([
          api.resumes.get(id),
          api.resumes.getInterviewQuestions(id).catch(() => null),
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

  function toggleQuestion(index: number) {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  }

  async function handleGenerate() {
    if (!resume || !id) return;
    setGenerating(true);
    setError("");
    setResult(null);
    setExpandedQuestions(new Set());
    try {
      const parsed = await api.resumes.interviewQuestions(id, {
        jobDescription: jobDescription || undefined,
        questionCount,
        focusAreas: focusAreas || undefined,
      });
      setResult(parsed);
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

  function getConfidenceColor(score: number): string {
    if (score >= 70) return "bg-green-100 text-green-700";
    if (score >= 40) return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  }

  const groupedQuestions = result
    ? (Object.keys(categoryConfig) as (keyof typeof categoryConfig)[]).reduce((acc, cat) => {
        const qs = result.questions.filter((q) => q.category === cat);
        if (qs.length) acc[cat] = qs;
        return acc;
      }, {} as Record<string, InterviewQuestion[]>)
    : {};

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Interview Questions"
        subtitle={
          !generating && !result
            ? "Generate realistic interview questions tailored to your resume and job description."
            : generating
              ? "Crafting your interview questions..."
              : "Your interview questions are ready!"
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
            rows={5}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          />
          <div>
            <label htmlFor="question-count" className="block text-xs font-medium text-gray-500 mb-1.5">Number of Questions</label>
            <div className="flex flex-row items-center gap-3">
              <input type="range" id="question-count" min={4} max={16} step={2} value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} className="flex-1" />
              <span className="text-sm font-semibold text-gray-700 min-w-[3ch] text-center">{questionCount}</span>
            </div>
          </div>
          <Input
            label="Focus Areas (optional)"
            placeholder="e.g. system design, leadership, React, AWS"
            value={focusAreas}
            onChange={(e) => setFocusAreas(e.target.value)}
          />
          <Button onClick={handleGenerate}>Generate Questions</Button>
        </div>
      )}

      {generating && (
        <div className="flex flex-col items-center gap-6 mt-8">
          <img src="/images/resume-scan.gif" className="w-64" />
          <p className="text-sm text-gray-500 animate-pulse">Analyzing your resume and crafting realistic interview questions...</p>
        </div>
      )}

      {error && <ErrorBanner error={error} onRetry={handleGenerate} className="w-full max-w-4xl" />}

      {result && !generating && (
        <div className="w-full max-w-4xl flex flex-col gap-6 animate-in fade-in duration-1000">
          <div className="flex flex-row gap-3 justify-end">
            <Link to={`/resumes/${id}`} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Back to Review
            </Link>
          </div>

          <Card>
            <div className="flex flex-row items-center gap-6">
              <div className="flex flex-col items-center">
                <div className={cn("size-24 rounded-full flex items-center justify-center text-2xl font-bold", getConfidenceColor(result.confidence))}>{result.confidence}%</div>
                <p className="text-xs text-gray-500 mt-1">Readiness</p>
              </div>
              <div className="flex-1"><p className="text-gray-700 leading-relaxed">Based on your resume and the job requirements, here is your estimated interview readiness score.</p></div>
            </div>
          </Card>

          {Object.entries(groupedQuestions).map(([cat, questions]) => (
            <div key={cat} className="flex flex-col gap-3">
              <div className="flex flex-row items-center gap-2">
                <span className="text-lg">{categoryConfig[cat as keyof typeof categoryConfig].icon}</span>
                <h3 className="text-xl font-semibold text-gray-900">{categoryConfig[cat as keyof typeof categoryConfig].label}</h3>
                <span className="text-sm text-gray-400 ml-auto">{questions.length} question{questions.length > 1 ? "s" : ""}</span>
              </div>
              {questions.map((q, i) => {
                const globalIndex = result.questions.indexOf(q);
                const isExpanded = expandedQuestions.has(globalIndex);
                return (
                  <Card key={globalIndex}>
                    <button onClick={() => toggleQuestion(globalIndex)} className="w-full flex flex-row items-start gap-4 p-5 text-left hover:bg-gray-50 transition-colors">
                      <span className="flex-shrink-0 size-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm font-semibold mt-0.5">{globalIndex + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-row items-center gap-2 mb-1.5">
                          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", categoryConfig[q.category as keyof typeof categoryConfig]?.class)}>{categoryConfig[q.category as keyof typeof categoryConfig]?.label}</span>
                          <span className={cn("text-xs px-2 py-0.5 rounded-full", difficultyConfig[q.difficulty].class)}>{difficultyConfig[q.difficulty].label}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 leading-relaxed pr-4">{q.question}</p>
                      </div>
                      <svg className={cn("size-4 mt-2 flex-shrink-0 transition-transform duration-200", isExpanded && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-0 border-t border-gray-100">
                        <div className="mt-4">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">💡 Talking Points</h4>
                          <ul className="space-y-1.5">
                            {q.talkingPoints.map((point, j) => (
                              <li key={j} className="text-sm text-gray-700 flex items-start gap-2"><span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>{point}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="mt-4">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">🔍 What the Interviewer Is Looking For</h4>
                          <p className="text-sm text-gray-700 leading-relaxed">{q.whatInterviewerLooksFor}</p>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          ))}
          {result.preparationTips.length > 0 && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 Preparation Tips</h3>
              <ul className="space-y-3">
                {result.preparationTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                    <span className="flex-shrink-0 size-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-semibold">{i + 1}</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {result.keyTopicsToReview.length > 0 && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📚 Key Topics to Review</h3>
              <div className="flex flex-wrap gap-2">
                {result.keyTopicsToReview.map((topic, i) => (
                  <span key={i} className="px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium">{topic}</span>
                ))}
              </div>
            </Card>
          )}
          <Button onClick={handleGenerate}>Regenerate Questions</Button>
        </div>
      )}
    </PageShell>
  );
}