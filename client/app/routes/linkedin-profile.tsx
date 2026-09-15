import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import { PageShell, PageHeader, Button, Input, Textarea, Card, Modal, ModalFooter, Select, ScoreBadge, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | LinkedIn Profile Optimizer" },
  { name: "description", content: "Analyze and optimize your LinkedIn profile for target roles" },
];

function LocalScoreBadge({ score }: { score: number }) {
  const config = score >= 80 ? { label: "Excellent", class: "bg-green-100 text-green-700" }
    : score >= 60 ? { label: "Good", class: "bg-blue-100 text-blue-700" }
    : score >= 40 ? { label: "Average", class: "bg-yellow-100 text-yellow-700" }
    : { label: "Needs Work", class: "bg-red-100 text-red-700" };
  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold", config.class)}>
      {score}/100 · {config.label}
    </span>
  );
}

export default function LinkedInProfile() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [profileText, setProfileText] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [savedProfiles, setSavedProfiles] = useState<any[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"analysis" | "headline" | "summary" | "experience" | "skills" | "networking">("analysis");

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadProfiles();
  }, [isAuthenticated]);

  async function loadProfiles() {
    setLoadingProfiles(true);
    try {
      const data = await api.linkedin.list();
      setSavedProfiles(data);
    } catch (err) {
      console.error("Failed to load profiles:", err);
    }
    setLoadingProfiles(false);
  }

  async function handleAnalyze() {
    if (!profileText.trim() || !targetRole.trim()) return;
    setGenerating(true);
    setError("");
    try {
      const parsed = await api.linkedin.analyze({ profileText, targetRole } as any);
      setResult(parsed);
      toastSuccess("Analysis complete", "Your LinkedIn profile analysis is ready");
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

  async function handleReanalyze(targetRole: string) {
    setGenerating(true);
    setError("");
    try {
      const parsed = await api.linkedin.analyze({ profileText, targetRole } as any);
      setResult(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to re-analyze");
    }
    setGenerating(false);
  }

  async function handleViewProfile(id: string) {
    setViewingProfileId(id);
    try {
      const profile = await api.linkedin.get(id);
      setResult(profile);
    } catch (err) {
      reportError(err, { title: "Load failed", toastError });
    }
  }

  async function handleDeleteProfile(id: string) {
    if (!confirm("Delete this profile analysis?")) return;
    try {
      await api.linkedin.delete(id);
      setSavedProfiles(prev => prev.filter(p => p.id !== id));
      toastSuccess("Profile deleted");
    } catch (err) {
      reportError(err, { title: "Delete failed", toastError });
    }
  }

  const tabs = [
    { key: "analysis", label: "Full Analysis" },
    { key: "headline", label: "Headline Suggestions" },
    { key: "summary", label: "Summary Improvements" },
    { key: "experience", label: "Experience Improvements" },
    { key: "skills", label: "Skill Recommendations" },
    { key: "networking", label: "Networking Tips" },
  ];

  if (loadingProfiles) {
    return (
      <PageShell>
        <PageHeader title="LinkedIn Profile Optimizer" subtitle="Loading your saved profiles..." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Card key={i} className="h-48 animate-pulse bg-gray-100"><div className="h-full" /></Card>)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="LinkedIn Profile Optimizer"
        subtitle="Analyze and optimize your LinkedIn profile for target roles"
        action={
          <Button variant="secondary" onClick={() => { setResult(null); setProfileText(""); setProfileUrl(""); setTargetRole(""); }}>
            New Analysis
          </Button>
        }
      />

      {error && <ErrorBanner error={error} onRetry={handleAnalyze} />}

      {/* Saved Profiles Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1">
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Saved Profiles</h3>
            {savedProfiles.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No saved profiles yet</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {savedProfiles.map(profile => (
                  <button
                    key={profile.id}
                    onClick={() => handleViewProfile(profile.id)}
                    className={cn("w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between gap-2",
                      viewingProfileId === profile.id ? "bg-primary-50 border border-primary-200" : "hover:bg-gray-50"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{profile.targetRole || "Untitled"}</p>
                      <p className="text-xs text-gray-500 truncate">{profile.profileUrl || "No URL"}</p>
                    </div>
                    <LocalScoreBadge score={profile.overallScore} />
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
              <form onSubmit={handleAnalyze} className="space-y-4">
                <Input
                  label="Target Role"
                  placeholder="e.g. Senior Software Engineer"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  required
                />
                <Input
                  label="LinkedIn Profile URL (optional)"
                  placeholder="https://linkedin.com/in/yourname"
                  value={profileUrl}
                  onChange={(e) => setProfileUrl(e.target.value)}
                />
                <Textarea
                  label="Paste Your LinkedIn Profile Text"
                  placeholder="Copy and paste your full LinkedIn profile content here..."
                  rows={8}
                  value={profileText}
                  onChange={(e) => setProfileText(e.target.value)}
                  required
                />
                <Button type="submit" disabled={generating} className="w-full">
                  {generating ? "Analyzing..." : "Analyze Profile"}
                </Button>
              </form>
            </Card>
          ) : generating ? (
            <Card className="text-center py-12">
              <img src="/images/resume-scan.gif" className="w-64 mx-auto" alt="" aria-hidden="true" />
              <p className="mt-4 text-sm text-gray-500 animate-pulse">Analyzing your LinkedIn profile...</p>
            </Card>
          ) : result && (
            <div className="space-y-6 animate-in fade-in duration-1000">
              {/* Tab Navigation */}
              <div className="flex gap-2 border-b border-gray-200">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={cn("px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                      activeTab === tab.key ? "border-primary-500 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "analysis" && (
                <Card>
                  <div className="flex flex-row items-center gap-6 mb-6">
                    <div className="flex flex-col items-center">
                      <div className={cn("size-24 rounded-full flex items-center justify-center text-2xl font-bold", result.overallScore >= 80 ? "bg-green-100 text-green-700" : result.overallScore >= 60 ? "bg-blue-100 text-blue-700" : result.overallScore >= 40 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700")}>
                        {result.overallScore}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Overall Score</p>
                    </div>
                    <div className="flex-1"><p className="text-gray-700 leading-relaxed">{result.summary}</p></div>
                  </div>

                  {result.headlineSuggestions?.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Headline Suggestions</h3>
                      <div className="flex flex-wrap gap-2">
                        {result.headlineSuggestions.map((h: string, i: number) => (
                          <span key={i} className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm font-medium">{h}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.summaryImprovements?.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Summary Improvements</h3>
                      <ul className="list-disc list-inside space-y-1 text-gray-700">
                        {result.summaryImprovements.map((s: string, i: number) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.experienceImprovements?.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Experience Improvements</h3>
                      <ul className="list-disc list-inside space-y-1 text-gray-700">
                        {result.experienceImprovements.map((e: string, i: number) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.skillRecommendations?.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Skill Recommendations</h3>
                      <div className="flex flex-wrap gap-2">
                        {result.skillRecommendations.map((s: string, i: number) => (
                          <span key={i} className="px-3 py-1 bg-info-50 border border-info-100 text-info-700 rounded-lg text-sm font-medium">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.networkingTips?.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Networking Tips</h3>
                      <ul className="list-disc list-inside space-y-2 text-gray-700">
                        {result.networkingTips.map((t: string, i: number) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              )}

              {activeTab === "headline" && result.headlineSuggestions && (
                <Card>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Headline Suggestions</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.headlineSuggestions.map((h: string, i: number) => (
                      <span key={i} className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm font-medium">{h}</span>
                    ))}
                  </div>
                </Card>
              )}

              {activeTab === "summary" && result.summaryImprovements && (
                <Card>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary Improvements</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    {result.summaryImprovements.map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </Card>
              )}

              {activeTab === "experience" && result.experienceImprovements && (
                <Card>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Experience Improvements</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    {result.experienceImprovements.map((e: string, i: number) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </Card>
              )}

              {activeTab === "skills" && result.skillRecommendations && (
                <Card>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Skill Recommendations</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.skillRecommendations.map((s: string, i: number) => (
                      <span key={i} className="px-3 py-1 bg-info-50 border border-info-100 text-info-700 rounded-lg text-sm font-medium">{s}</span>
                    ))}
                  </div>
                </Card>
              )}

              {activeTab === "networking" && result.networkingTips && (
                <Card>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Networking Tips</h3>
                  <ul className="list-disc list-inside space-y-2 text-gray-700">
                    {result.networkingTips.map((t: string, i: number) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </Card>
              )}

              <div className="flex gap-3 justify-end">
                <Button variant="secondary" onClick={() => { setResult(null); setProfileText(""); setProfileUrl(""); setTargetRole(""); }}>New Analysis</Button>
                <Button onClick={() => handleReanalyze(targetRole)}>Re-analyze</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}