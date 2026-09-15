import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  // Public routes (no auth layout)
  index("routes/landing.tsx"),
  route("/login", "routes/login.tsx"),
  route("/register", "routes/register.tsx"),
  route("/auth", "routes/auth.tsx"),
  route("/share/:token", "routes/share.tsx"),
  route("/onboarding", "routes/onboarding.tsx"),

  // Authenticated app layout
  layout("components/Layout.tsx", [
    // Dashboard (was home)
    route("/dashboard", "routes/dashboard.tsx"),

    // Job Search & Discovery (PRIMARY NAV)
    route("/jobs", "routes/jobs.tsx"),
    route("/jobs/:id", "routes/jobs.$id.tsx"),
    route("/saved-searches", "routes/saved-searches.tsx"),
    route("/job-alerts", "routes/job-alerts.tsx"),
    route("/companies", "routes/companies.tsx"),
    route("/companies/:id", "routes/companies.$id.tsx"),

    // Applications Pipeline (SECONDARY NAV)
    route("/applications", "routes/applications.tsx"),
    route("/applications/analytics", "routes/applications-analytics.tsx"),
    route("/applications/:id", "routes/application-detail.tsx"),

    // Interview Preparation
    route("/interview-prep", "routes/interview-prep.tsx"),
    route("/interview-schedule", "routes/interview-schedule.tsx"),
    route("/interview-notes", "routes/interview-notes.tsx"),
    route("/interviewer-feedback", "routes/interviewer-feedback.tsx"),
    route("/mock-interview", "routes/mock-interview.tsx"),
    route("/technical-practice", "routes/technical-practice.tsx"),
    route("/behavioral-bank", "routes/behavioral-bank.tsx"),
    route("/interview-cheat-sheet", "routes/interview-cheat-sheet.tsx"),
    route("/panel-interview", "routes/panel-interview.tsx"),
    route("/case-study", "routes/case-study.tsx"),
    route("/interview-analytics", "routes/interview-analytics.tsx"),

    // Offers & Negotiation
    route("/offers", "routes/offers.tsx"),
    route("/offers/compare", "routes/offer-comparison.tsx"),
    route("/offers/negotiate", "routes/salary-negotiation.tsx"),
    route("/offers/negotiate/:id", "routes/offers.negotiate.$id.tsx"),
    route("/offers/equity", "routes/equity-calculator.tsx"),
    route("/offers/benefits", "routes/benefits-analyzer.tsx"),
    route("/offers/decide", "routes/decision-framework.tsx"),
    route("/offers/resign", "routes/resignation-letter.tsx"),

    // Resume & Profile (SUPPORTING)
    route("/resumes", "routes/resumes.tsx"),
    route("/resumes/new", "routes/generate-resume.tsx"),
    route("/resumes/upload", "routes/upload.tsx"),
    route("/resumes/batch", "routes/batch-upload.tsx"),
    route("/resumes/batch/:id", "routes/batch.tsx"),
    route("/resumes/:id", "routes/resumes.$id.tsx"),
    route("/resumes/:id/edit", "routes/resumes.$id.edit.tsx"),
    route("/resumes/:id/cover-letter", "routes/cover-letter.tsx"),
    route("/resumes/:id/skill-gap", "routes/skill-gap.tsx"),
    route("/resumes/:id/interview-questions", "routes/interview-questions.tsx"),
    route("/resumes/:id/salary-estimate", "routes/salary-estimate.tsx"),
    route("/resumes/:id/multi-jd", "routes/multi-jd.tsx"),
    route("/resumes/:id/templates", "routes/templates.tsx"),
    route("/resumes/:id/tailored", "routes/resumes.$id.tailored.tsx"),
    route("/resumes/:id/versions", "routes/resume-versions.tsx"),
    route("/cover-letter-templates", "routes/cover-letter-templates.tsx"),
    route("/linkedin-profile", "routes/linkedin-profile.tsx"),
    route("/portfolio", "routes/portfolio.tsx"),
    route("/references", "routes/references.tsx"),

    // Profile & Settings
    route("/profile", "routes/profile.tsx"),
    route("/wipe", "routes/wipe.tsx"),

    // Onboarding & Career Transition
    route("/onboarding/plan", "routes/onboarding-plan.tsx"),
    route("/onboarding/checklist", "routes/onboarding-checklist.tsx"),
    route("/onboarding/manager-alignment", "routes/manager-alignment.tsx"),
    route("/onboarding/network-map", "routes/network-map.tsx"),
    route("/onboarding/skill-refresh", "routes/skill-refresh.tsx"),
    route("/onboarding/first-90-days", "routes/first-90-days.tsx"),
    route("/onboarding/first-90-days/:id", "routes/onboarding.first-90-days.$id.tsx"),
    route("/follow-up-emails", "routes/follow-up-emails.tsx"),
  ]),
] satisfies RouteConfig;
