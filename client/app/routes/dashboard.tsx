import type { JobApplication, InterviewScheduleEntry, InterviewNote, FollowUpEmail } from "types";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { Skeleton } from "~/components/Skeleton";
import { Button, Card, useToastHelpers } from "~/components/ui";
import { ErrorBanner, reportError } from "~/components/ui";

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function isClosed(status: string): boolean {
  return status === "rejected" || status === "accepted" || status === "withdrawn";
}

/** One thing that deserves the user's attention today. */
interface Nudge {
  id: string;
  kind: "interview" | "stale" | "offer" | "draft" | "closed-loop" | "followup";
  urgency: "now" | "soon" | "later";
  title: string;
  detail: string;
  to: string;
  cta: string;
}

export default function Dashboard() {
  const [pipeline, setPipeline] = useState<JobApplication[]>([]);
  const [upcomingInterviews, setUpcomingInterviews] = useState<InterviewScheduleEntry[]>([]);
  const [notes, setNotes] = useState<InterviewNote[]>([]);
  const [unsentEmails, setUnsentEmails] = useState<FollowUpEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { error: toastError } = useToastHelpers();

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    async function load() {
      try {
        const [pipelineData, scheduleData, noteData, emailData] = await Promise.allSettled([
          api.applications.list({ limit: 100 }),
          api.interviewPrep.listSchedule({ status: "upcoming" }),
          api.interviewProcess.listNotes(),
          api.interviewProcess.listFollowUpEmails(),
        ]);
        if (pipelineData.status === "fulfilled") {
          setPipeline((pipelineData.value?.applications || []) as unknown as JobApplication[]);
        }
        if (scheduleData.status === "fulfilled") setUpcomingInterviews(scheduleData.value || []);
        if (noteData.status === "fulfilled") setNotes(noteData.value || []);
        if (emailData.status === "fulfilled") {
          setUnsentEmails((emailData.value || []).filter((e) => !e.sentAt));
        }
      } catch (err) {
        reportError(err, { title: "Couldn't load your day", toastError, setError, retry: load });
      }
      setLoading(false);
    }
    load();
  }, [isAuthenticated]);

  const allApps = pipeline || [];
  const activeApps = allApps.filter((a) => !isClosed(a.status));
  const now = new Date();
  const upcoming = upcomingInterviews
    .filter((i: InterviewScheduleEntry) => new Date(i.scheduledAt) > now)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  // ---- Build the Today nudges: the whole lifecycle, filtered to what needs you ----
  const nudges: Nudge[] = [];

  for (const i of upcoming.slice(0, 3)) {
    const when = new Date(i.scheduledAt);
    const daysAway = Math.ceil((when.getTime() - now.getTime()) / 86400000);
    nudges.push({
      id: `interview-${i.id}`,
      kind: "interview",
      urgency: daysAway <= 1 ? "now" : "soon",
      title: `${i.companyName} — ${i.roleTitle}`,
      detail: daysAway <= 0
        ? `Interview ${when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} today`
        : `Interview in ${daysAway === 1 ? "1 day" : `${daysAway} days`} · ${when.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`,
      to: "/interview-schedule",
      cta: "Prep now",
    });
  }

  for (const app of activeApps) {
    if (app.status === "offer") {
      nudges.push({
        id: `offer-${app.id}`,
        kind: "offer",
        urgency: "now",
        title: `Offer from ${app.companyName}`,
        detail: "Compare it against your other options and negotiate before deciding.",
        to: `/applications/${app.id}`,
        cta: "Review offer",
      });
    }
    if (app.status === "accepted") {
      nudges.push({
        id: `accepted-${app.id}`,
        kind: "closed-loop",
        urgency: "now",
        title: `You accepted ${app.roleTitle} at ${app.companyName} 🎉`,
        detail: "Turn the offer into a 30-60-90 day plan so day one goes well.",
        to: `/onboarding/first-90-days?applicationId=${app.id}&company=${encodeURIComponent(app.companyName)}&role=${encodeURIComponent(app.roleTitle)}`,
        cta: "Plan first 90 days",
      });
    }
    if (app.status === "draft") {
      nudges.push({
        id: `draft-${app.id}`,
        kind: "draft",
        urgency: "later",
        title: `${app.roleTitle} at ${app.companyName}`,
        detail: "Still in Draft — tailor your resume before you submit.",
        to: `/applications/${app.id}`,
        cta: "Finish & submit",
      });
    }
    const since = daysSince(app.updatedAt || app.appliedAt || app.createdAt);
    if (app.status === "applied" && since !== null && since >= 10) {
      nudges.push({
        id: `stale-${app.id}`,
        kind: "stale",
        urgency: since >= 21 ? "soon" : "later",
        title: `${app.companyName} — no reply for ${since} days`,
        detail: "Send a polite follow-up, or move it on if you've heard back.",
        to: `/applications/${app.id}`,
        cta: "Follow up",
      });
    }
  }

  // Drafted-but-unsent follow-up emails: the interview loop's open ends.
  // The nudge links back to the note they came from, where the email can be
  // reviewed, copied, and marked sent.
  const noteById = new Map(notes.map((n) => [n.id, n]));
  for (const email of unsentEmails.slice(0, 4)) {
    const note = email.interviewNoteId ? noteById.get(email.interviewNoteId) : null;
    const age = daysSince(email.createdAt) ?? 0;
    nudges.push({
      id: `followup-${email.id}`,
      kind: "followup",
      urgency: age >= 7 ? "now" : age >= 3 ? "soon" : "later",
      title: note
        ? `Follow-up for ${note.companyName} — ${note.roleTitle}`
        : `Follow-up email: ${email.subject}`,
      detail: `\u201C${email.subject}\u201D drafted ${age === 0 ? "today" : age === 1 ? "yesterday" : `${age} days ago`} — copy it and send.`,
      // Land on the notes page with that email's preview expanded, ready
      // to copy or mark sent (fall back to the emails hub when orphaned).
      to: note
        ? `/interview-notes?note=${note.id}&email=${email.id}`
        : "/follow-up-emails",
      cta: "Review & send",
    });
  }

  const urgentFirst: Record<Nudge["urgency"], number> = { now: 0, soon: 1, later: 2 };
  nudges.sort((a, b) => urgentFirst[a.urgency] - urgentFirst[b.urgency]);

  const counts = {
    total: allApps.length,
    active: activeApps.length,
    interviewing: activeApps.filter((a) => a.status === "interviewing" || a.status === "phone_screen").length,
    offers: activeApps.filter((a) => a.status === "offer").length,
    drafts: activeApps.filter((a) => a.status === "draft").length,
    waiting: activeApps.filter((a) => a.status === "applied").length,
  };

  if (loading) {
    return (
      <div className="p-8 max-w-[1200px] mx-auto">
        <div className="space-y-6">
          <div className="h-12 w-72 bg-[#F5EDE4] rounded-lg animate-pulse" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  const firstName = session?.user?.name?.split(" ")[0];

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      {/* Greeting — the day, not the org chart */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {firstName ? `Your day, ${firstName}` : "Your day"}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {nudges.length > 0
              ? `${nudges.filter((n) => n.urgency === "now").length} need${nudges.filter((n) => n.urgency === "now").length === 1 ? "s" : ""} attention now · ${counts.active} active job${counts.active !== 1 ? "s" : ""}`
              : counts.active > 0
                ? "Everything's moving — nothing needs you right now."
                : "Start your search below. Every job you consider will live here."}
          </p>
        </div>
        <Link to="/jobs">
          <Button>Find Jobs</Button>
        </Link>
      </div>

      {error && <ErrorBanner error={error} onRetry={() => navigate(0)} />}

      {/* Journey snapshot — stages of the lifecycle, not vanity metrics */}
      {counts.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {[
            { label: "Drafting", count: counts.drafts, to: "/applications", stage: "draft" },
            { label: "Waiting", count: counts.waiting, to: "/applications", stage: "applied" },
            { label: "Interviewing", count: counts.interviewing, to: "/interview-schedule", stage: "interviewing" },
            { label: "Offers", count: counts.offers, to: "/offers", stage: "offer" },
            { label: "Total Jobs", count: counts.total, to: "/applications" },
          ].map((s) => (
            <Link key={s.label} to={s.to} className="block">
              <Card className="p-4 hover:shadow-md transition-shadow">
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className="text-2xl font-bold text-gray-900">{s.count}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Empty state — first-time user */}
      {counts.total === 0 && (
        <Card className="mb-8 p-8">
          <div className="max-w-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Start with a job, not a dashboard</h3>
            <p className="text-sm text-gray-600 mb-5">
              Find a role you like, match it against your resume, tailor everything, and track it from
              application to offer to your first 90 days — all in one place.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to="/jobs"><Button>Find Jobs</Button></Link>
              <Link to="/resumes"><Button variant="outline">Start from My Resume</Button></Link>
            </div>
          </div>
        </Card>
      )}

      {/* Today — the unified brief across every stage */}
      {counts.total > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">Today</h2>
                <Link to="/applications"><Button variant="ghost" size="sm">All Jobs</Button></Link>
              </div>
              {nudges.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm font-medium text-gray-900 mb-1">Nothing needs you today</p>
                  <p className="text-xs text-gray-500">
                    Keep the pipeline moving when you're ready — new applications, follow-ups, and prep all start from a job.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {nudges.slice(0, 8).map((n) => (
                    <Link
                      key={n.id}
                      to={n.to}
                      className="flex items-center gap-4 p-3 rounded-lg border border-[#E8DDD1] bg-[#FFFBF5] hover:bg-[#FFF8F0] hover:border-primary-200 transition-colors"
                    >
                      <span
                        className={`shrink-0 w-1.5 h-10 rounded-full ${
                          n.urgency === "now" ? "bg-danger" : n.urgency === "soon" ? "bg-warning" : "bg-gray-300"
                        }`}
                        aria-hidden="true"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                        <p className="text-xs text-gray-600 truncate">{n.detail}</p>
                      </div>
                      <span className="text-xs font-medium text-primary-600 shrink-0">{n.cta} →</span>
                    </Link>
                  ))}
                  {nudges.length > 8 && (
                    <p className="text-xs text-gray-400 text-center pt-1">+{nudges.length - 8} more across your pipeline</p>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* Right rail: the journey, one click away */}
          <div className="space-y-6">
            <Card>
              <h2 className="text-base font-semibold text-gray-900 mb-4">The Journey</h2>
              <div className="space-y-1">
                {[
                  { to: "/jobs", label: "1 · Find a job", hint: "Search & match" },
                  { to: "/resumes", label: "2 · Prepare", hint: "Tailor resume & cover letter" },
                  { to: "/applications", label: "3 · Track", hint: "Your pipeline by stage" },
                  { to: "/interview-schedule", label: "4 · Interview", hint: "Schedule, prep, notes" },
                  { to: "/offers", label: "5 · Land the offer", hint: "Compare & negotiate" },
                  { to: "/onboarding/first-90-days", label: "6 · First 90 days", hint: "Plan your start" },
                ].map((step) => (
                  <Link
                    key={step.to}
                    to={step.to}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-[#FFFBF5] transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 group-hover:text-primary-600 transition-colors">{step.label}</p>
                      <p className="text-xs text-gray-500">{step.hint}</p>
                    </div>
                    <span className="text-gray-300 group-hover:text-primary-400 transition-colors">→</span>
                  </Link>
                ))}
              </div>
            </Card>

            {upcoming.length > 0 && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-900">Next Interview</h2>
                  <Link to="/interview-schedule"><Button variant="ghost" size="sm">All</Button></Link>
                </div>
                {(() => {
                  const next = upcoming[0];
                  const when = new Date(next.scheduledAt);
                  return (
                    <div className="p-3 border border-[#E8DDD1] rounded-lg bg-[#FFFBF5]">
                      <p className="text-sm font-medium text-gray-900">{next.companyName}</p>
                      <p className="text-xs text-gray-600">{next.roleTitle}</p>
                      <p className="text-xs text-gray-900 font-medium mt-2">
                        {when.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })} ·{" "}
                        {when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                  );
                })()}
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
