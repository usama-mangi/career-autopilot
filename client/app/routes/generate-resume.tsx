import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { PageShell, PageHeader, Button, Input, Textarea, Card, useToastHelpers, ScoreCircle, reportError } from "~/components/ui";
import type { UserProfile, ProfileCompletion } from "types";

export const meta = () => [
  { title: "Career Autopilot | Generate Resume" },
];

export default function GenerateResumePage() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [profile, setProfile] = useState<any | null>(null);
  const [completion, setCompletion] = useState<ProfileCompletion | null>(null);

  // Pre-filled from job context
  const [targetRole, setTargetRole] = useState(searchParams.get('job') || '');
  const [companyName, setCompanyName] = useState(searchParams.get('company') || '');
  const [jobDescription, setJobDescription] = useState('');

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadProfile();
  }, [isAuthenticated]);

  async function loadProfile() {
    try {
      const data = await api.profile.get();
      setProfile(data);
      setCompletion(data.completion);

      // If jobId is provided, fetch job description
      const jobId = searchParams.get('jobId');
      if (jobId) {
        try {
          const job = await api.jobs.get(jobId);
          if (job?.description && !jobDescription) {
            setJobDescription(job.description);
          }
          if (job?.title && !targetRole) setTargetRole(job.title);
          if (job?.companyName && !companyName) setCompanyName(job.companyName);
        } catch {
          // Job fetch is optional — user can still type manually
        }
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
    setLoading(false);
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await api.resumes.generate({
        targetRole: targetRole || undefined,
        jobDescription: jobDescription || undefined,
        companyName: companyName || undefined,
      });
      toastSuccess("Resume generated", "Your resume has been created from your profile");
      navigate(`/resumes/${result.id}`);
    } catch (err) {
      reportError(err, {
        title: "Generation failed",
        toastError,
        retry: handleGenerate,
      });
    }
    setGenerating(false);
  }

  if (isPending || loading) {
    return (
      <PageShell>
        <div className="max-w-2xl mx-auto py-12 animate-pulse">
          <div className="h-8 w-64 bg-gray-200 rounded mb-4" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </PageShell>
    );
  }

  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  const pct = completion?.percentage || 0;
  const hasMinimum = pct >= 70;

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Generate Resume"
        subtitle="Create a tailored resume from your profile data"
      />

      <div className="space-y-6">
        {/* Profile status */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <ScoreCircle score={pct} size="md" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Profile {pct}% Complete</p>
              <p className="text-xs text-gray-500">
                {hasMinimum
                  ? "Your profile has enough data to generate a resume"
                  : "Complete more of your profile for a better resume"}
              </p>
            </div>
            {!hasMinimum && (
              <Button variant="secondary" size="sm" onClick={() => navigate("/profile")} className="ml-auto">
                Complete Profile
              </Button>
            )}
          </div>
        </Card>

        {/* Job context (optional) */}
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Target Role (Optional)</h3>
          <p className="text-sm text-gray-500">Tailor your resume for a specific role. Leave blank for a general resume.</p>
          <Input label="Job Title" placeholder="e.g. Senior Software Engineer" value={targetRole} onChange={e => setTargetRole(e.target.value)} />
          <Input label="Company" placeholder="e.g. Google" value={companyName} onChange={e => setCompanyName(e.target.value)} />
          <Textarea label="Job Description" placeholder="Paste the job description here for a more targeted resume..." value={jobDescription} onChange={e => setJobDescription(e.target.value)} rows={5} />
        </Card>

        {/* Profile preview */}
        {profile && (
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Profile Summary</h3>
            <div className="space-y-2 text-sm">
              {profile.user?.headline && <p><span className="text-gray-400">Role:</span> <span className="font-medium text-gray-900">{profile.user.headline}</span></p>}
              {profile.user?.location && <p><span className="text-gray-400">Location:</span> <span className="text-gray-700">{profile.user.location}</span></p>}
              {profile.profile?.education?.length > 0 && (
                <p><span className="text-gray-400">Education:</span> <span className="text-gray-700">{profile.profile.education.length} entries</span></p>
              )}
              {profile.profile?.experience?.length > 0 && (
                <p><span className="text-gray-400">Experience:</span> <span className="text-gray-700">{profile.profile.experience.length} entries</span></p>
              )}
              {profile.profile?.skills?.length > 0 && (
                <div>
                  <span className="text-gray-400">Skills:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {profile.profile.skills.slice(0, 10).map((s: string) => (
                      <span key={s} className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded text-xs">{s}</span>
                    ))}
                    {profile.profile.skills.length > 10 && <span className="text-xs text-gray-400">+{profile.profile.skills.length - 10} more</span>}
                  </div>
                </div>
              )}
              {profile.profile?.projects?.length > 0 && (
                <p><span className="text-gray-400">Projects:</span> <span className="text-gray-700">{profile.profile.projects.length} projects</span></p>
              )}
            </div>
          </Card>
        )}

        {/* Generate button */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleGenerate}
          disabled={generating || !hasMinimum}
        >
          {generating ? "Generating..." : hasMinimum ? "Generate Resume" : "Complete your profile first"}
        </Button>
      </div>
    </PageShell>
  );
}
