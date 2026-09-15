import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import { PageShell, PageHeader, Button, Input, Textarea, Card, ScoreBadge, Select, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";
import type { TechnicalAssessment } from "types";

export const meta = () => [
  { title: "Career Autopilot | Technical Practice" },
  { name: "description", content: "Coding challenges, system design prompts, and take-home simulations for target roles" },
];

const difficultyConfig = {
  easy: { label: "Easy", class: "bg-green-100 text-green-700" },
  medium: { label: "Medium", class: "bg-yellow-100 text-yellow-700" },
  hard: { label: "Hard", class: "bg-red-100 text-red-700" },
};

const priorityConfig = {
  high: { label: "High Priority", class: "bg-red-100 text-red-700" },
  medium: { label: "Medium Priority", class: "bg-yellow-100 text-yellow-700" },
  low: { label: "Low Priority", class: "bg-green-100 text-green-700" },
};

export default function TechnicalPractice() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [practices, setPractices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [targetDifficulty, setTargetDifficulty] = useState("mixed");
  const [focusAreas, setFocusAreas] = useState("");
  const [expandedChallenge, setExpandedChallenge] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"challenges" | "system-design" | "take-home" | "all">("all");

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadPractices();
  }, [isAuthenticated]);

  async function loadPractices() {
    setLoading(true);
    try {
      const data = await api.interviewPrep.listTechnicals();
      setPractices(data);
    } catch (err) {
      console.error("Failed to load practices:", err);
    }
    setLoading(false);
  }

  async function handleGenerate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!roleTitle.trim()) return;
    setGenerating(true);
    setError("");
    setResult(null);
    try {
      const data = await api.interviewPrep.generateTechnical({
        roleTitle: roleTitle.trim(),
        jobDescription: jobDescription.trim() || undefined,
        resumeText: resumeText.trim() || undefined,
        targetDifficulty,
        focusAreas: focusAreas.trim() || undefined,
      } as any);
      setResult(data);
      toastSuccess("Practice generated", "Your technical practice session is ready");
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

  async function handleLoadPractice(id: string) {
    try {
      const data = await api.interviewPrep.getTechnical(id);
      setResult(data);
    } catch (err) {
      console.error("Failed to load practice:", err);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this practice session?")) return;
    try {
      await api.interviewPrep.deleteTechnical(id);
      setPractices((prev) => prev.filter((p) => p.id !== id));
      toastSuccess("Practice deleted");
    } catch (err) {
      reportError(err, { title: "Delete failed", toastError });
    }
  }

  function getDifficultyColor(diff: string) {
    return diff === "easy" ? "bg-green-100 text-green-700" : diff === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
  }

  function getPriorityColor(pri: string) {
    return pri === "high" ? "bg-red-100 text-red-700" : pri === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700";
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Technical Practice" subtitle="Loading your practice sessions..." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Card key={i} className="h-48 animate-pulse bg-gray-100"><span>{i}</span></Card>)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Technical Practice"
        subtitle="Coding challenges, system design prompts, and take-home simulations for your target role"
        action={<Button variant="secondary" onClick={() => { setResult(null); setRoleTitle(""); setJobDescription(""); setResumeText(""); }}>New Practice</Button>}
      />

      {error && <ErrorBanner error={error} onRetry={handleGenerate} />}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Saved Practices */}
        <aside className="lg:col-span-1">
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Saved Practice Sessions</h3>
            {practices.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No saved sessions yet</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {practices.map((practice) => (
                  <button
                    key={practice.id}
                    onClick={() => handleLoadPractice(practice.id)}
                    className="w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{practice.roleTitle || "Untitled"}</p>
                      <p className="text-xs text-gray-500 truncate">{practice.difficulty || "Mixed"}</p>
                    </div>
                    <ScoreBadge score={practice.difficulty === "hard" ? 85 : practice.difficulty === "medium" ? 65 : 45} size="sm" showLabel={false} variant="compact" />
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
                <h3 className="font-semibold text-gray-900">Generate New Practice Session</h3>

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
                  placeholder="Paste your resume for personalized challenges..."
                  rows={3}
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Difficulty Focus"
                    value={targetDifficulty}
                    onChange={(e) => setTargetDifficulty(e.target.value)}
                    options={[
                      { value: "mixed", label: "Mixed (Recommended)" },
                      { value: "easy", label: "Easy" },
                      { value: "medium", label: "Medium" },
                      { value: "hard", label: "Hard" },
                    ]}
                  />
                  <Input
                    label="Focus Areas (optional)"
                    placeholder="e.g. Graphs, Dynamic Programming, System Design"
                    value={focusAreas}
                    onChange={(e) => setFocusAreas(e.target.value)}
                  />
                </div>

                <Button type="submit" disabled={generating} className="w-full">
                  {generating ? "Generating..." : "Generate Practice Session"}
                </Button>
              </form>
            </Card>
          ) : generating ? (
            <Card className="text-center py-12">
              <img src="/images/resume-scan.gif" className="w-64 mx-auto" alt="" aria-hidden="true" />
              <p className="mt-4 text-sm text-gray-500 animate-pulse">Generating coding challenges, system design prompts, and take-home simulations...</p>
            </Card>
          ) : result && (
            <div className="space-y-6 animate-in fade-in duration-1000">
              {/* Section Tabs */}
              <div className="flex gap-2 border-b border-gray-200">
                {["all", "challenges", "system-design", "take-home"].map((section) => (
                  <button
                    key={section}
                    onClick={() => setActiveSection(section as typeof activeSection)}
                    className={cn(
                      "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                      activeSection === section
                        ? "border-primary-500 text-primary-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    )}
                  >
                    {section === "all" ? "All" : section === "challenges" ? "Coding Challenges" : section === "system-design" ? "System Design" : "Take-Home"}
                  </button>
                ))}
              </div>

              {(activeSection === "all" || activeSection === "challenges") && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Coding Challenges</h3>
                  {result.codingChallenges?.map((challenge: any, i: number) => (
                    <Card key={i} className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", getDifficultyColor(challenge.difficulty))}>
                          {difficultyConfig[challenge.difficulty as keyof typeof difficultyConfig].label}
                        </span>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", getPriorityColor(challenge.priority))}>
                          {priorityConfig[challenge.priority as keyof typeof priorityConfig].label}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
                          {challenge.category}
                        </span>
                      </div>
                      <h4 className="font-semibold text-gray-900">{challenge.title}</h4>
                      <p className="text-gray-700">{challenge.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {challenge.tags?.map((tag: string) => (
                          <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{tag}</span>
                        ))}
                      </div>
                      {challenge.constraints && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs font-medium text-gray-500 mb-1">Constraints:</p>
                          <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
                            {challenge.constraints.map((c: string) => <li key={c}>{c}</li>)}
                          </ul>
                        </div>
                      )}
                      {challenge.examples && challenge.examples.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs font-medium text-gray-500 mb-1">Examples:</p>
                          {challenge.examples.map((ex: any['examples'][number], ei: number) => (
                            <div key={ei} className="text-sm text-gray-700">
                              <p className="font-medium">Input: {ex.input}</p>
                              <p>Output: {ex.output}</p>
                              {ex.explanation && <p className="text-gray-500 mt-0.5">{ex.explanation}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                      {challenge.hints && challenge.hints.length > 0 && (
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-xs font-medium text-blue-700 mb-1">Hints:</p>
                          <ul className="list-disc list-inside text-sm text-blue-700 space-y-0.5">
                            {challenge.hints.map((h: string) => <li key={h}>{h}</li>)}
                          </ul>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setExpandedChallenge(expandedChallenge === challenge.title ? null : challenge.title)}>
                          {expandedChallenge === challenge.title ? "Hide Details" : "Show Details"}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {(activeSection === "all" || activeSection === "system-design") && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">System Design Prompts</h3>
                  {result.systemDesignPrompts?.map((prompt: any, i: number) => (
                    <Card key={i} className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", getDifficultyColor(prompt.difficulty))}>
                          {difficultyConfig[prompt.difficulty as keyof typeof difficultyConfig].label}
                        </span>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", getPriorityColor(prompt.priority))}>
                          {priorityConfig[prompt.priority as keyof typeof priorityConfig].label}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
                          {prompt.category}
                        </span>
                      </div>
                      <h4 className="font-semibold text-gray-900">{prompt.title}</h4>
                      <p className="text-gray-700">{prompt.description}</p>
                      {prompt.requirements && prompt.requirements.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs font-medium text-gray-500 mb-1">Requirements:</p>
                          <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
                            {prompt.requirements.map((r: string) => <li key={r}>{r}</li>)}
                          </ul>
                        </div>
                      )}
                      {prompt.keyConsiderations && prompt.keyConsiderations.length > 0 && (
                        <div className="bg-yellow-50 rounded-lg p-3">
                          <p className="text-xs font-medium text-yellow-700 mb-1">Key Considerations:</p>
                          <ul className="list-disc list-inside text-sm text-yellow-700 space-y-0.5">
                            {prompt.keyConsiderations.map((c: string) => <li key={c}>{c}</li>)}
                          </ul>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}

              {(activeSection === "all" || activeSection === "take-home") && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Take-Home Simulations</h3>
                  {result.takeHomeSimulations?.map((sim: any, i: number) => (
                    <Card key={i} className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", getDifficultyColor(sim.difficulty))}>
                          {difficultyConfig[sim.difficulty as keyof typeof difficultyConfig].label}
                        </span>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", getPriorityColor(sim.priority))}>
                          {priorityConfig[sim.priority as keyof typeof priorityConfig].label}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
                          {sim.category}
                        </span>
                      </div>
                      <h4 className="font-semibold text-gray-900">{sim.title}</h4>
                      <p className="text-gray-700">{sim.description}</p>
                      {sim.tasks && sim.tasks.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs font-medium text-gray-500 mb-1">Tasks:</p>
                          <ol className="list-decimal list-inside text-sm text-gray-700 space-y-0.5">
                            {sim.tasks.map((t: string) => <li key={t}>{t}</li>)}
                          </ol>
                        </div>
                      )}
                      {sim.timeLimit && (
                        <p className="text-xs text-gray-500">Time Limit: {sim.timeLimit} hours</p>
                      )}
                      {sim.deliverables && sim.deliverables.length > 0 && (
                        <div className="bg-green-50 rounded-lg p-3">
                          <p className="text-xs font-medium text-green-700 mb-1">Deliverables:</p>
                          <ul className="list-disc list-inside text-sm text-green-700 space-y-0.5">
                            {sim.deliverables.map((d: string) => <li key={d}>{d}</li>)}
                          </ul>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
