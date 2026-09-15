import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { PageShell, PageHeader, Button, Input, Textarea, Card, Button as UIButton, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Company Research" },
  { name: "description", content: "AI-generated company research briefing for interview preparation" },
];

const sentimentConfig = {
  positive: { class: "bg-success-50 text-success-700 border-success-100" },
  neutral: { class: "bg-gray-100 text-gray-700 border-gray-200" },
  negative: { class: "bg-danger-50 text-danger-700 border-danger-100" },
};

export default function InterviewPrep() {
  const { id } = useParams();
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { error: toastError } = useToastHelpers();

  const [briefings, setBriefings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [activeTab, setActiveTab] = useState<"briefing" | "technical" | "behavioral" | "questions" | "culture">("briefing");

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadBriefings();
  }, [isAuthenticated]);

  async function loadBriefings() {
    setLoading(true);
    try {
      const data = await api.interviewPrep.listBriefings();
      setBriefings(data);
    } catch (err) {
      console.error("Failed to load briefings:", err);
    }
    setLoading(false);
  }

  async function handleGenerate() {
    if (!companyName.trim() || !roleTitle.trim()) return;
    setGenerating(true);
    setError("");
    setResult(null);
    try {
      const data = await api.interviewPrep.generateBriefing({
        companyName: companyName.trim(),
        roleTitle: roleTitle.trim(),
        jobDescription: jobDescription.trim() || undefined,
        resumeText: resumeText.trim() || undefined,
      } as any);
      setResult(data);
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

  async function handleLoadBriefing(id: string) {
    try {
      const data = await api.interviewPrep.getBriefing(id);
      setResult(data);
    } catch (err) {
      console.error("Failed to load briefing:", err);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this briefing?")) return;
    try {
      await api.interviewPrep.deleteBriefing(id);
      setBriefings(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      console.error("Failed to delete briefing:", err);
    }
  }

  const tabs = [
    { key: "briefing", label: "Company Briefing" },
    { key: "technical", label: "Technical Prep" },
    { key: "behavioral", label: "Behavioral Prep" },
    { key: "questions", label: "Interview Questions" },
    { key: "culture", label: "Culture & Values" },
  ];

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Interview Preparation" subtitle="Loading your briefings..." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Card key={i} className="h-48 animate-pulse bg-gray-100"><div className="h-full" /></Card>)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Interview Preparation"
        subtitle="AI-generated company research briefings for interview preparation"
        action={
          <Button onClick={() => { setResult(null); setCompanyName(""); setRoleTitle(""); setJobDescription(""); setResumeText(""); }}>+ New Briefing</Button>
        }
      />

      {error && <ErrorBanner error={error} onRetry={handleGenerate} />}

      {briefings.length === 0 && !result ? (
        <Card className="text-center py-12">
          <svg className="mx-auto size-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-4 text-gray-500">No briefings yet. Create your first company research briefing!</p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Saved Briefings */}
        <aside className="lg:col-span-1">
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Saved Briefings</h3>
            {briefings.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No briefings yet</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {briefings.map(briefing => (
                  <button
                    key={briefing.id}
                    onClick={() => handleLoadBriefing(briefing.id)}
                    className="w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{briefing.companyName}</p>
                      <p className="text-sm text-gray-500 truncate">{briefing.roleTitle}</p>
                      <p className="text-xs text-gray-400 mt-1">{new Date(briefing.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(briefing.id); }}
                      className="text-red-400 hover:text-red-600 p-1"
                      aria-label="Delete briefing"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
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
                <h3 className="font-semibold text-gray-900">Create New Briefing</h3>
                <Input
                  label="Company Name"
                  placeholder="e.g. Google"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
                <Input
                  label="Role Title"
                  placeholder="e.g. Senior Software Engineer"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  required
                />
                <Textarea
                  label="Job Description (optional)"
                  placeholder="Paste the job description here..."
                  rows={4}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                />
                <Textarea
                  label="Your Resume Text (optional)"
                  placeholder="Paste your resume text for tailored insights..."
                  rows={3}
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                />
                <Button type="submit" disabled={generating} className="w-full">
                  {generating ? "Generating..." : "Generate Briefing"}
                </Button>
              </form>
            </Card>
          ) : generating ? (
            <Card className="text-center py-12">
              <img src="/images/resume-scan.gif" className="w-64 mx-auto" alt="" aria-hidden="true" />
              <p className="mt-4 text-sm text-gray-500 animate-pulse">Researching company and generating briefing...</p>
            </Card>
          ) : result && (
            <div className="space-y-6 animate-in fade-in duration-1000">
              {/* Tab Navigation */}
              <div role="tablist" className="flex gap-2 border-b border-[#E8DDD1]" aria-label="Interview preparation sections">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    role="tab"
                    aria-selected={activeTab === tab.key}
                    aria-controls={`interview-tabpanel-${tab.key}`}
                    id={`interview-tab-${tab.key}`}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.key
                        ? "border-primary-500 text-primary-600"
                        : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "briefing" && (
                <div role="tabpanel" id="interview-tabpanel-briefing" aria-labelledby="interview-tab-briefing" className="animate-in fade-in duration-150">
                  <Card>
	                <div className="mb-6">
	                  <h3 className="text-2xl font-bold text-gray-900">{result.companyName}</h3>
	                  <p className="text-gray-600 mt-1">{result.roleTitle} — Company Research Briefing</p>
	                  <p className="text-sm text-gray-500 mt-2">Generated {new Date(result.createdAt).toLocaleDateString()}</p>
	                </div>

	                 {result.mission && (
	                  <div className="mb-6">
	                    <h4 className="font-semibold text-gray-900 mb-2">Mission & Vision</h4>
	  ;                  <p className="text-gray-700 leading-relaxed">{result.mission}</p>
	                  </div>
	                )}

	                {result.products?.length > 0 && (
	                  <div className="mb-6">
	                    <h4 className="font-semibold text-gray-900 mb-3">Products & Services</h4>
	                    <ul className="list-disc list-inside space-y-1 text-gray-700">
	                      {result.products.map((p: string, i: number) => <li key={i}>{p}</li>)}
	                    </ul>
	                  </div>
	                )}

	                {result.recentNews?.length > 0 && (
	                  <div className="mb-6">
	                    <h4 className="font-semibold text-gray-900 mb-3">Recent News</h4>
	                    <ul className="space-y-3">
	                      {result.recentNews.map((n: any, i: number) => (
	                        <li key={i} className="p-3 bg-gray-50 rounded-lg">
	                          <h5 className="font-medium text-gray-900">{n.title}</h5>
	                          <p className="text-sm text-gray-600 mt-1">{n.summary}</p>
	                          <p className="text-xs text-gray-500 mt-1">{n.date} — {n.source}</p>
	                        </li>
	                      ))}
	                    </ul>
	                  </div>
	                )}

	                {result.financials && (
	                  <div className="mb-6">
	                    <h4 className="font-semibold text-gray-900 mb-3">Financial Overview</h4>
	                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
	                      {Object.entries(result.financials as Record<string, string>).map(([k, v]) => (
	                        <div key={k} className="bg-gray-50 p-3 rounded-lg">
	                          <p className="text-gray-500">{k}</p>
	                          <p className="font-semibold text-gray-900">{v}</p>
	                        </div>
	                      ))}
	                    </div>
	                  </div>
	                )}

	                {result.culture?.length > 0 && (
	                  <div className="mb-6">
	                    <h4 className="font-semibold text-gray-900 mb-3">Culture & Values</h4>
	                    <div className="flex flex-wrap gap-2">
	                      {result.culture.map((v: string, i: number) => (
	                        <span key={i} className="px-3 py-1 bg-info-50 border border-info-100 text-info-700 rounded-lg text-sm font-medium">{v}</span>
	                      ))}
	                    </div>
	                  </div>
	                )}

	                {result.interviewProcess && (
	                  <div>
	                    <h4 className="font-semibold text-gray-900 mb-3">Interview Process</h4>
	                    <div className="space-y-2">
	                      {result.interviewProcess.map((s: string, i: number) => (
	                        <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
	                          <span className="size-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-bold">{i + 1}</span>
	                          <p className="text-gray-700">{s}</p>
	                        </div>
	                      ))}
                        </div>
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {activeTab === "technical" && result.technicalPrep && (
                <div role="tabpanel" id="interview-tabpanel-technical" aria-labelledby="interview-tab-technical" className="animate-in fade-in duration-150">
                  <Card>
	                <h3 className="text-lg font-semibold text-gray-900 mb-4">Technical Preparation</h3>
	                <div className="space-y-6">
	                  {result.technicalPrep.topics?.length > 0 && (
	                    <div>
	                      <h4 className="font-semibold text-gray-900 mb-3">Key Topics</h4>
	                      <div className="flex flex-wrap gap-2">
	                        {result.technicalPrep.topics.map((t: string, i: number) => (
	                          <span key={i} className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm font-medium">{t}</span>
	                        ))}
	                      </div>
	                    </div>
	                  )}
	                  {result.technicalPrep.resources?.length > 0 && (
	                    <div>
	                      <h4 className="font-semibold text-gray-900 mb-3">Recommended Resources</h4>
	                      <ul className="space-y-2">
	                        {result.technicalPrep.resources.map((r: string, i: number) => (
	                          <li key={i} className="flex items-start gap-2 text-gray-700">
	                            <span className="text-blue-500 mt-0.5">•</span> {r}
	                          </li>
	                        ))}
	                      </ul>
	                    </div>
	                  )}
	                  {result.technicalPrep.practiceProblems?.length > 0 && (
	                    <div>
	                      <h4 className="font-semibold text-gray-900 mb-3">Practice Problems</h4>
	                      <ul className="space-y-2">
	                        {result.technicalPrep.practiceProblems.map((p: string, i: number) => (
	                          <li key={i} className="flex items-start gap-2 text-gray-700">
	                            <span className="text-success mt-0.5" aria-hidden="true">✓</span> {p}
	                          </li>
	                        ))}
	                      </ul>
	                    </div>
	                  )}
	                </div>
	              </Card>
	            </div>
              )}

              {activeTab === "behavioral" && result.behavioralPrep && (
                <div role="tabpanel" id="interview-tabpanel-behavioral" aria-labelledby="interview-tab-behavioral" className="animate-in fade-in duration-150">
                  <Card>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Behavioral Preparation</h3>
                    <div className="space-y-6">
                      {result.behavioralPrep.competencies?.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3">Key Competencies</h4>
                          <div className="space-y-4">
                            {result.behavioralPrep.competencies.map((c: any, i: number) => (
                              <div key={i} className="p-4 bg-gray-50 rounded-lg">
                                <h5 className="font-medium text-gray-900 mb-2">{c.competency}</h5>
                                <p className="text-sm text-gray-600 mb-3">{c.description}</p>
                                <div className="space-y-2">
                                  {c.questions?.map((q: string, j: number) => (
                                    <p key={j} className="text-sm text-gray-700">• {q}</p>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {result.behavioralPrep.starExamples?.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3">STAR Framework Examples</h4>
                          <div className="space-y-3">
                            {result.behavioralPrep.starExamples.map((e: any, i: number) => (
                              <div key={i} className="p-4 bg-gray-50 rounded-lg">
                                <p className="font-medium text-gray-900">{e.situation}</p>
                                <p className="text-sm text-gray-600 mt-1">{e.task}</p>
                                <p className="text-sm text-gray-600 mt-1">{e.action}</p>
                                <p className="text-sm text-green-700 mt-1">Result: {e.result}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              )}

              {activeTab === "questions" && result.interviewQuestions && (
                <div role="tabpanel" id="interview-tabpanel-questions" aria-labelledby="interview-tab-questions" className="animate-in fade-in duration-150">
                  <Card>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Interview Questions</h3>
                    <div className="space-y-4">
                      {result.interviewQuestions.map((q: any, i: number) => (
                        <div key={i} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs font-medium">{q.category}</span>
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs font-medium">{q.difficulty}</span>
                          </div>
                          <p className="font-medium text-gray-900 mb-2">{q.question}</p>
                          <details className="text-sm text-gray-600">
                            <summary className="cursor-pointer text-primary-600 hover:underline mb-1">View suggested answer approach</summary>
                            <div className="mt-2 p-3 bg-white rounded border">{q.answerApproach}</div>
                          </details>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}

              {activeTab === "culture" && result.cultureInsights && (
                <div role="tabpanel" id="interview-tabpanel-culture" aria-labelledby="interview-tab-culture" className="animate-in fade-in duration-150">
                  <Card>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Culture & Values</h3>
                  <div className="space-y-6">
                    {result.cultureInsights.values?.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Core Values</h4>
                        <div className="flex flex-wrap gap-2">
                          {result.cultureInsights.values.map((v: string, i: number) => (
                            <span key={i} className="px-3 py-1 bg-info-50 border border-info-100 text-info-700 rounded-lg text-sm font-medium">{v}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {result.cultureInsights.employeeReviews?.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Employee Sentiment</h4>
                        <div className="flex flex-wrap gap-2">
                          {result.cultureInsights.employeeReviews.map((r: any, i: number) => (
                            <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{r.sentiment}: {r.topic}</span>
                          ))}
                        </div>
                      </div>
                    )}
{result.cultureInsights.glassdoorRating && (
                      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                        <div className="text-3xl font-bold text-primary-600">{result.cultureInsights.glassdoorRating}</div>
                        <div>
                          <p className="font-semibold text-gray-900">Glassdoor Rating</p>
                          <p className="text-sm text-gray-500">{result.cultureInsights.glassdoorReviewCount} reviews</p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}

              <div className="flex gap-3 justify-end">
                <Button variant="secondary" onClick={() => { setResult(null); setCompanyName(""); setRoleTitle(""); setJobDescription(""); setResumeText(""); }}>New Briefing</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
