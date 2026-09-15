import { Link } from "react-router";
import { PageShell, Button } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot — one pipeline from job search to first 90 days" },
  { name: "description", content: "Search jobs, tailor your resume to each posting, track applications, prep for interviews, and compare offers. Scores, notes, and offers stay linked in one pipeline." },
];

const CAMPS = [
  { id: "search", label: "Job Search", desc: "Discover roles across LinkedIn, Indeed, Glassdoor", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z", phase: 1 },
  { id: "resume", label: "Resume & Cover Letter", desc: "AI generates and tailors per job", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", phase: 2 },
  { id: "apply", label: "Application Tracker", desc: "Kanban pipeline, comms log, referrals", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", phase: 3 },
  { id: "interview", label: "Interview Prep", desc: "Company briefings, mock interviews, STAR coaching", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", phase: 4 },
  { id: "process", label: "Interview Process", desc: "Notes, feedback, follow-ups, panel coordination", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", phase: 5 },
  { id: "offer", label: "Offer & Negotiation", desc: "Comparison, equity calc, salary coaching", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1", phase: 6 },
  { id: "onboard", label: "Onboarding", desc: "30-60-90 plans, manager alignment, network map", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", phase: 7 },
];

export default function Landing() {
  return (
    <PageShell className="min-h-screen">
      {/* Nav — warm paper */}
      <nav className="flex items-center justify-between py-5 max-w-6xl mx-auto px-6 lg:px-8 relative z-10">
        <Link to="/" className="flex items-center gap-3">
          {/* Compass rose logo */}
          <div className="w-9 h-9 rounded-full border-2 border-primary-500 bg-primary-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-primary-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4m0 12v4M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" strokeLinecap="round" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <span className="text-lg font-bold text-gray-900 tracking-tight">Career Autopilot</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link to="/register">
            <Button size="sm">Create account</Button>
          </Link>
        </div>
      </nav>

      {/* Hero — Route Map */}
      <section className="max-w-6xl mx-auto px-6 lg:px-8 pt-16 pb-24 lg:pt-24 lg:pb-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left — thesis + CTA */}
          <div className="relative z-10">
            <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 tracking-[-0.03em] leading-[1.05] mb-6">
              One pipeline from
              <br />
              search to signed offer.
            </h1>

            <p className="text-lg text-gray-600 leading-relaxed mb-8 max-w-lg">
              Job boards, resumes, tracking, interview prep, and offers usually
              live in five tools. Here they share one database: the resume you
              scored against a posting feeds the interview you prep for, and the
              offer you compare.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <Link to="/register">
                <Button size="lg" className="w-full sm:w-auto px-8">
                  Create free account
                </Button>
              </Link>
              <Link to="/jobs">
                <Button variant="outline" size="lg" className="w-full sm:w-auto px-8">
                  Browse jobs
                </Button>
              </Link>
            </div>

            <p className="text-sm text-gray-500">No credit card required. Free to start.</p>
          </div>

          {/* Right — Route Map visualization */}
          <div className="relative">
            {/* Route map card */}
            <div className="relative bg-white rounded-2xl border border-[#E8DDD1] shadow-lg p-6 lg:p-7">
              {/* Header — field note style */}
              <div className="flex items-center justify-between pb-4 border-b border-[#E8DDD1] mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-[#E8DDD1]" />
                  <div className="w-3 h-3 rounded-full border-2 border-[#E8DDD1]" />
                  <div className="w-3 h-3 rounded-full border-2 border-[#E8DDD1]" />
                </div>
                <span className="text-xs font-medium text-gray-500 tracking-wide uppercase">Route Overview</span>
              </div>

              {/* Route map — vertical timeline */}
              <div className="relative space-y-1">
                {/* Vertical route line */}
                <div className="absolute left-[19px] top-5 bottom-5 w-px bg-[#E8DDD1]" />

                {CAMPS.map((camp, i) => (
                  <div key={camp.id} className="flex items-start gap-4 relative group">
                    {/* Waypoint marker */}
                    <div className={`waypoint-marker shrink-0 relative z-10 ${
                      i === 0 ? "waypoint-marker-active" : ""
                    }`}>
                      {i === 0 ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d={camp.icon} />
                        </svg>
                      ) : (
                        <span className="text-xs font-semibold text-gray-400">{camp.phase}</span>
                      )}
                    </div>

                    {/* Camp info */}
                    <div className={`flex-1 pb-4 ${i === CAMPS.length - 1 ? "pb-0" : ""}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${
                          i === 0 ? "text-primary-600" : "text-gray-900"
                        }`}>
                          {camp.label}
                        </span>
                        {i === 0 && (
                          <span className="text-[10px] font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-100">
                            You are here
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{camp.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer — sherpa status */}
              <div className="mt-5 pt-4 border-t border-[#E8DDD1] flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#065F46] flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900">Why the context carries over</p>
                  <p className="text-[10px] text-gray-500">One data model behind all seven stages</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works — The Traverse */}
      <section className="py-20 bg-[#FFF8F0] border-t border-[#E8DDD1]">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="max-w-lg mb-14">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Seven stages, one record per job</h2>
            <p className="text-gray-600">Each stage below writes back to the same application, so nothing gets retyped and nothing gets lost between tools.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {CAMPS.map((camp) => (
              <Link key={camp.id} to="/login" className="block group">
                <div className="waypoint-card h-full">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0 group-hover:bg-primary-500 group-hover:border-primary-500 transition-colors duration-200">
                      <svg className="w-4 h-4 text-primary-500 group-hover:text-white transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d={camp.icon} />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Camp {camp.phase}</span>
                      <h3 className="text-sm font-semibold text-gray-900">{camp.label}</h3>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{camp.desc}</p>
                </div>
              </Link>
            ))}

            {/* The differentiator — compound context */}
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="bg-white rounded-xl border border-[#E8DDD1] p-6 shadow-paper">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#065F46] flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 mb-1">Every stage writes back</h3>
                    <p className="text-sm text-gray-600 leading-relaxed max-w-2xl">
                      Tailor a resume for a posting and the matched keywords are stored with the
                      application. Prep for the interview and the notes attach to that same record.
                      Get an offer and the comparison pulls the salary data you already entered.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA — End of trail */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <svg className="w-6 h-6 text-primary-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Score your first resume in minutes</h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">Create an account, paste a job posting, and see exactly where your resume matches and where it falls short.</p>
          <Link to="/register">
            <Button size="lg" className="px-8">Create free account</Button>
          </Link>
        </div>
      </section>

      {/* Footer — field notes */}
      <footer className="border-t border-[#E8DDD1] py-8 bg-[#FFF8F0]">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-gray-500">&copy; 2026 Career Autopilot</span>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link to="/login" className="hover:text-gray-700 transition-colors">Sign in</Link>
            <Link to="/register" className="hover:text-gray-700 transition-colors">Create account</Link>
          </div>
        </div>
      </footer>
    </PageShell>
  );
}
