import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { PageShell, PageHeader, Button, Input, Textarea, Card, Modal, ModalFooter, Select, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Mock Interview" },   { name: "description", content: "Practice interview questions and get scored feedback" },
];

const QUESTION_TYPES = {
  behavioral: { label: "Behavioral", color: "bg-info-50 text-info-700" },
  technical: { label: "Technical", color: "bg-[#F5EDE4] text-gray-700" },
  situational: { label: "Situational", color: "bg-warning-50 text-warning-700" },
  case_study: { label: "Case Study", color: "bg-primary-50 text-primary-600" },
};

export default function MockInterview() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeInterview, setActiveInterview] = useState<any | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    type: "behavioral",
    role: "",
    company: "",
    jobDescription: "",
    questionCount: 5,
  });

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadInterviews();
  }, [isAuthenticated]);

  async function loadInterviews() {
      try {
        const data = await (api.interviewPrep as any).listMockInterviews();
        setInterviews(data);
      } catch (err) {
        console.error("Failed to load interviews:", err);
      } finally {
        setLoading(false);
      }
    }

    async function handleStart(e: React.FormEvent) {
      e.preventDefault();
      if (!formData.role.trim()) return;
      setGenerating(true);
      setError("");
      try {
        const interview = await  (api.interviewPrep as any).createMockInterview({
          type: formData.type,
          roleTitle: formData.role,
          company: formData.company || undefined,
          jobDescription: formData.jobDescription || undefined,
          questionCount: formData.questionCount,
        });
        setActiveInterview(interview);
        setAnswers(new Array(interview.questions.length).fill(""));
        setCurrentQuestionIndex(0);
        setShowFeedback(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start interview");
      }
      setGenerating(false);
    }

  function handleAnswerChange(index: number, value: string) {
    setAnswers(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  async function handleSubmit() {
    if (!activeInterview) return;
    setGenerating(true);
    try {
      const result = await  (api.interviewPrep as any).sendMockMessage(activeInterview.id, answers.join(" "));
      setFeedback(result);
      setShowFeedback(true);
    } catch (err) {
      reportError(err, {
        title: "Feedback failed",
        toastError,
        setError,
        retry: handleSubmit,
      });
    }
    setGenerating(false);
  }

  function handleNext() {
    if (currentQuestionIndex < (activeInterview?.questions.length || 0) - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  }

  function handlePrev() {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  }

  function handleRestart() {
    if (!activeInterview) return;
    setAnswers(new Array(activeInterview.questions.length).fill(""));
    setCurrentQuestionIndex(0);
    setShowFeedback(false);
    setFeedback(null);
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this interview?")) return;
     (api.interviewPrep as any).deleteMockInterview(id).then(() => {
      setInterviews(prev => prev.filter(i => i.id !== id));
      if (activeInterview?.id === id) setActiveInterview(null);
    });
  }

  const currentQuestion = activeInterview?.questions?.[currentQuestionIndex];

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Mock Interview" subtitle="Loading..." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Card key={i} className="h-48 animate-pulse bg-gray-100"><div className="h-full" /></Card>)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Mock Interview Simulator"
        subtitle="Practice with AI-generated questions and get real-time feedback"
        action={<Button onClick={() => setActiveInterview(null)}>+ New Interview</Button>}
      />

      {error && <ErrorBanner error={error} onRetry={handleSubmit} />}

      {/* Interview List / Setup */}
      {!activeInterview && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Saved Interviews */}
          <aside className="lg:col-span-1">
            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">Your Interviews</h3>
              {interviews.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No interviews yet. Create one to start practicing!</p>
              ) : (
                <div className="space-y-2">
                  {interviews.map(interview => (
                    <button
                      key={interview.id}
                      onClick={() => {
                        setActiveInterview(interview);
                        setAnswers(new Array(interview.questions.length).fill(""));
                        setCurrentQuestionIndex(0);
                        setShowFeedback(false);
                      }}
                      className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{interview.role}</p>
                        <p className="text-xs text-gray-500 truncate">{interview.company || "General"}</p>
                        <p className="text-xs text-gray-400 mt-1">{interview.questions.length} questions · {interview.type}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="text-red-500" onClick={(e) => { e.stopPropagation(); handleDelete(interview.id); }}>Delete</Button>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </aside>

          {/* New Interview Form */}
          <div className="lg:col-span-2">
            <Card>
              <form onSubmit={handleStart} className="space-y-4">
                <h3 className="font-semibold text-gray-900">Start New Mock Interview</h3>

                <Select
                  label="Interview Type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  options={Object.entries(QUESTION_TYPES).map(([k, v]) => ({ value: k, label: v.label }))}
                />

                <Input
                  label="Target Role"
                  placeholder="e.g. Senior Software Engineer"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  required
                />

                <Input
                  label="Company (optional)"
                  placeholder="e.g. Google"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />

                <Textarea
                  label="Job Description (optional)"
                  placeholder="Paste the job description for tailored questions..."
                  rows={3}
                  value={formData.jobDescription}
                  onChange={(e) => setFormData({ ...formData, jobDescription: e.target.value })}
                />

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Number of Questions"
                    type="number"
                    min="3"
                    max="10"
                    value={formData.questionCount}
                    onChange={(e) => setFormData({ ...formData, questionCount: Number(e.target.value) })}
                  />
                </div>

                <Button type="submit" disabled={generating} className="w-full">
                  {generating ? "Generating..." : "Start Interview"}
                </Button>
              </form>
            </Card>
          </div>
        </div>
      )}

      {/* Active Interview */}
      {activeInterview && !showFeedback && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{activeInterview.role}</h2>
              <p className="text-gray-500">{activeInterview.company || "General"} · {activeInterview.type} · {activeInterview.questions.length} questions</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm">
                Question {currentQuestionIndex + 1} of {activeInterview.questions.length}
              </span>
            </div>
          </div>

          {currentQuestion && (
            <Card>
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${QUESTION_TYPES[currentQuestion.type as keyof typeof QUESTION_TYPES]?.color}`}>
                    {QUESTION_TYPES[currentQuestion.type as keyof typeof QUESTION_TYPES]?.label}
                  </span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">Difficulty: {currentQuestion.difficulty}</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{currentQuestion.question}</h3>
              </div>

              <Textarea
                label="Your Answer"
                placeholder="Type your response here..."
                rows={6}
                value={answers[currentQuestionIndex] || ""}
                onChange={(e) => handleAnswerChange(currentQuestionIndex, e.target.value)}
              />

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={handlePrev} disabled={currentQuestionIndex === 0}>Previous</Button>
                  {currentQuestionIndex === activeInterview.questions.length - 1 ? (
                    <Button onClick={handleSubmit} disabled={generating}>{generating ? "Get Feedback..." : "Submit for Feedback"}</Button>
                  ) : (
                    <Button onClick={handleNext}>Next</Button>
                  )}
                </div>
                <div className="flex gap-1">
                  {activeInterview.questions.map((_: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => setCurrentQuestionIndex(i)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${i === currentQuestionIndex ? "bg-primary-500 text-white" : answers[i] ? "bg-[#ECFDF5] text-[#065F46]" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          )}

          <Button variant="outline" onClick={() => setActiveInterview(null)}>Exit Interview</Button>
        </div>
      )}

      {/* Feedback View */}
      {showFeedback && feedback && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Interview Feedback</h2>
              <p className="text-gray-500">{activeInterview?.role} · {activeInterview?.company}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-600">{feedback.overallScore}/100</div>
                <div className="text-sm text-gray-500">Overall Score</div>
              </div>
            </div>
          </div>

          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Summary</h3>
            <p className="text-gray-700 leading-relaxed">{feedback.summary}</p>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="text-success" aria-hidden="true">✓</span> Strengths
              </h3>
              <ul className="space-y-2">
                {feedback.strengths?.map((s: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-success mt-0.5" aria-hidden="true">•</span> {s}
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="text-danger" aria-hidden="true">⚠</span> Areas for improvement
              </h3>
              <ul className="space-y-2">
                {feedback.areasForImprovement?.map((a: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-danger mt-0.5" aria-hidden="true">•</span> {a}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Detailed Breakdown</h3>
            <div className="space-y-4">
              {feedback.questionFeedback?.map((qf: any, i: number) => (
                <div key={i} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">Q{i + 1}: {qf.question?.substring(0, 60)}...</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${qf.score >= 70 ? "bg-green-100 text-green-700" : qf.score >= 40 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                      {qf.score}/100
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{qf.feedback}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="bg-[#FFF8F0] border border-[#E8DDD1]">
            <h3 className="font-semibold text-gray-900 mb-3">Key Recommendations</h3>
            <ul className="space-y-2">
              {feedback.recommendations?.map((r: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-primary-500 mt-0.5">•</span> {r}
                </li>
              ))}
            </ul>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={handleRestart}>Try Again</Button>
            <Button variant="secondary" onClick={() => { setActiveInterview(null); setShowFeedback(false); }}>New Interview</Button>
            <Button variant="secondary" onClick={() => navigate(`/mock-interview/${feedback.id}`)}>View Details</Button>
          </div>
        </div>
      )}
    </PageShell>
  );
}