import type { BehavioralQuestionBank, BehavioralSTARQuestion } from "types";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import { PageShell, PageHeader, Button, Input, Textarea, Card, useToastHelpers, ScoreBadge, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Behavioral Question Bank" },
  { name: "description", content: "Curated behavioral questions with STAR framework templates per competency" },
];

const difficultyConfig = {
  easy: { label: "Easy", class: "bg-green-100 text-green-700" },
  medium: { label: "Medium", class: "bg-yellow-100 text-yellow-700" },
  hard: { label: "Hard", class: "bg-red-100 text-red-700" },
};

const competencyColors: Record<string, string> = {
  leadership: "bg-warning-50 text-warning-700",
  teamwork: "bg-info-50 text-info-700",
  problem_solving: "bg-success-50 text-success-700",
  adaptability: "bg-warning-50 text-warning-700",
  communication: "bg-primary-50 text-primary-600",
  ownership: "bg-info-50 text-info-700",
  conflict_resolution: "bg-red-100 text-red-700",
  growth_mindset: "bg-success-50 text-success-700",
};

export default function BehavioralBank() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [banks, setBanks] = useState<BehavioralQuestionBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<BehavioralQuestionBank | null>(null);
  const [error, setError] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [competencies, setCompetencies] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(8);
  const [showSTAR, setShowSTAR] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadBanks();
  }, [isAuthenticated]);

  async function loadBanks() {
    setLoading(true);
    try {
      const data = await api.interviewPrep.listBehaviorals();
      setBanks(data as BehavioralQuestionBank[]);
    } catch (err) {
      console.error("Failed to load banks:", err);
    }
    setLoading(false);
  }

  async function handleGenerate() {
    if (!roleTitle.trim()) return;
    setGenerating(true);
    setError("");
    setResult(null);
    try {
      const data = await api.interviewPrep.generateBehavioral({
        roleTitle: roleTitle.trim(),
        jobDescription: jobDescription.trim() || undefined,
        resumeText: resumeText.trim() || undefined,
        competencies: competencies.length > 0 ? competencies : undefined,
        questionCount,
      });
      setResult(data);
      toastSuccess("Questions generated", "Your behavioral question bank is ready");
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

  async function handleLoadBank(id: string) {
    try {
          const data = await api.interviewPrep.getBehavioral(id);
          setResult(data);
        } catch (err) {
          console.error("Failed to load bank:", err);
        }
      }

      async function handleDelete(id: string) {
        if (!confirm("Delete this question bank?")) return;
        try {
          await api.interviewPrep.deleteBehavioral(id);
          setBanks((prev) => prev.filter((b) => b.id !== id));
          toastSuccess("Deleted");
    } catch (err) {
      reportError(err, { title: "Delete failed", toastError });
    }
  }

  function toggleSTAR(index: number) {
    setShowSTAR((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  }

  const groupedByCompetency = result
    ? Object.keys(result.questions || {}).reduce((acc, competency) => {
        const questionsMap = result.questions as Record<string, BehavioralSTARQuestion[]>;
        acc[competency] = questionsMap[competency];
        return acc;
      }, {} as Record<string, BehavioralSTARQuestion[]>)
    : {};

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Behavioral Question Bank" subtitle="Loading your saved banks..." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Card key={i} className="h-48 animate-pulse bg-gray-100"><div className="h-full" /></Card>)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Behavioral Question Bank"
        subtitle="Curated STAR framework questions per competency for your target role"
        action={
          <Button
            variant="secondary"
            onClick={() => {
              setResult(null);
              setRoleTitle("");
              setJobDescription("");
              setResumeText("");
              setCompetencies([]);
            }}
          >
            New Bank
          </Button>
        }
      />

      {error && <ErrorBanner error={error} onRetry={handleGenerate} />}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Saved Banks */}
        <aside className="lg:col-span-1">
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Saved Question Banks</h3>
            {banks.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No saved banks yet</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {banks.map((bank) => (
                  <button
                    key={bank.id}
                    onClick={() => handleLoadBank(bank.id)}
                    className="w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{bank.roleTitle || "Untitled"}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {bank.competencies?.length || 0} competencies · {new Date(bank.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <ScoreBadge score={bank.overallScore || 75} size="sm" showLabel={false} variant="compact" />
                  </button>
                ))}
              </div>
            )}
          </Card>
        </aside>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {!result && !generating ? (
            <Card>
              <form onSubmit={handleGenerate} className="space-y-4">
                <h3 className="font-semibold text-gray-900">Generate New Question Bank</h3>

                <Input
                  label="Target Role"
                  placeholder="e.g. Senior Software Engineer"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  required
                />

                <Textarea
                  label="Job Description (optional)"
                  placeholder="Paste the job description for tailored questions..."
                  rows={4}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                />

                <Textarea
                  label="Your Resume Text (optional)"
                  placeholder="Paste your resume for personalized questions..."
                  rows={3}
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Competencies (comma-separated)"
                    placeholder="leadership, teamwork, problem-solving"
                    value={competencies.join(", ")}
                    onChange={(e) =>
                      setCompetencies(e.target.value.split(",").map((c) => c.trim()).filter(Boolean))
                    }
                  />
                  <Input
                    label="Number of Questions"
                    type="number"
                    min="4"
                    max="20"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                  />
                </div>

                <Button type="submit" disabled={generating} className="w-full">
                  {generating ? "Generating..." : "Generate Question Bank"}
                </Button>
              </form>
            </Card>
          ) : generating ? (
            <Card className="text-center py-12">
              <img src="/images/resume-scan.gif" className="w-64 mx-auto" alt="" aria-hidden="true" />
              <p className="mt-4 text-sm text-gray-500 animate-pulse">
                Generating STAR framework questions for your target role...
              </p>
            </Card>
          ) : result && (
            <div className="space-y-6 animate-in fade-in duration-1000">
              {/* Competency Tabs */}
              <div className="flex flex-wrap gap-2 border-b border-gray-200">
                <button
                  onClick={() => setShowSTAR(new Set())}
                  className="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors"
                >
                  All Questions
                </button>
                {Object.keys(groupedByCompetency).map((comp) => (
                  <button
                    key={comp}
                    onClick={() =>
                      setShowSTAR((prev) => {
                        const next = new Set(prev);
                        const compInt = parseInt(comp);
                        next.has(compInt) ? next.delete(compInt) : next.add(compInt);
                        return next;
                      })
                    }
                    className={cn(
                      "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                      showSTAR.has(parseInt(comp))
                        ? "border-primary-500 text-primary-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    )}
                  >
                    {comp.replace(/_/g, " ")}
                  </button>
                ))}
              </div>

              {Object.entries(groupedByCompetency).map(([competency, questions]) => (
                <div key={competency} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        competencyColors[competency] || "bg-gray-100 text-gray-700"
                      )}
                    >
                      {competency.replace(/_/g, " ")}
                    </span>
                    <span className="text-sm text-gray-400">{questions.length} questions</span>
                  </div>

                  {questions.map((q: BehavioralSTARQuestion, i: number) => {
                    const globalIndex = Object.values(groupedByCompetency).flat().indexOf(q);
                    const isSTARVisible = showSTAR.has(globalIndex);
                    return (
                      <Card key={globalIndex} className="space-y-3">
                        <div className="flex items-start gap-4">
                          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm font-semibold mt-0.5">
                            {globalIndex + 1}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span
                                className={cn(
                                  "text-xs font-medium px-2 py-0.5 rounded-full border",
                                  difficultyConfig[q.difficulty as keyof typeof difficultyConfig].class
                                )}
                              >
                                {difficultyConfig[q.difficulty as keyof typeof difficultyConfig].label}
                              </span>
                            </div>
                            <p className="font-medium text-gray-900 leading-relaxed pr-4">{q.question}</p>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{q.competency}</span>
                              <span className="text-gray-500">•</span>
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                                {q.difficulty}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleSTAR(globalIndex)}
                              className={isSTARVisible ? "bg-primary-50 text-primary-700" : ""}
                            >
                              {isSTARVisible ? "Hide STAR" : "Show STAR"}
                            </Button>
                          </div>
                        </div>

                        {isSTARVisible && (
                          <div className="px-5 pb-5 pt-0 border-t border-gray-100 space-y-3">
                            <div>
                              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                Situation
                              </h5>
                              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                                {q.star?.situation || "Describe the context and background of the situation..."}
                              </p>
                            </div>
                            <div>
                              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Task</h5>
                              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                                {q.star?.task || "What was your responsibility or goal?"}
                              </p>
                            </div>
                            <div>
                              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Action</h5>
                              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                                {q.star?.action || "What specific steps did YOU take?"}
                              </p>
                            </div>
                            <div>
                              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Result</h5>
                              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                                {q.star?.result || "What was the outcome? Quantify if possible."}
                              </p>
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              ))}

              <div className="flex gap-3 justify-end">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setResult(null);
                    setRoleTitle("");
                    setJobDescription("");
                    setResumeText("");
                    setCompetencies([]);
                  }}
                >
                  New Bank
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
