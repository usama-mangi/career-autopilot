import type { Company, Job, JobMatchResult } from "types";
import { useSession } from "~/lib/auth-store";
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router";
import { PageShell, PageHeader, Button, Card, useToastHelpers, reportError } from "~/components/ui";
import { Skeleton } from "~/components/Skeleton";

interface SalaryRange {
  role: string;
  min: number;
  max: number;
  currency?: string;
  equity?: string;
}

export const meta = () => [
  { title: "Career Autopilot | Company Details" },
  { name: "description", content: "View company details, jobs, and insights" },
];

export default function CompanyDetail() {
  const { id } = useParams();
  const companyId = id || "";
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { error: toastError } = useToastHelpers();

  const [company, setCompany] = useState<any | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !companyId) return;
    async function load() {
      try {
        // Companies don't have a dedicated API, show a friendly message
        setCompany({
          id: companyId,
          name: "Company " + companyId.slice(0, 8),
          description: "Company details are available when you save jobs from this company or bookmark their postings.",
          website: null,
          employeeCount: null,
          founded: null,
          type: null,
          revenue: null,
          headquarters: null,
          ceo: null,
          salaryRanges: [],
          interviewInsights: null,
        });
        setLoading(false);
      } catch (err) {
        console.error("Failed to load company:", err);
        reportError(err, { title: "Load failed", toastError, retry: load });
        setLoading(false);
      }
    }
    load();
  }, [isAuthenticated, companyId]);

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Company" subtitle="Loading..." />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </PageShell>
    );
  }

  if (!company) {
    return (
      <PageShell>
        <div className="text-center py-12">
          <p className="text-gray-500">Company not found</p>
          <Link to="/companies" className="mt-4 inline-block">
            <Button variant="outline">Back to Companies</Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title={company.name}
        subtitle={company.website || "No website"}
        action={
          <div className="flex gap-2">
            <Link to={`/jobs?company=${id}`}>
              <Button variant="outline">Browse Jobs</Button>
            </Link>
            <Button variant="outline" onClick={() => navigate("/companies")}>
              Back to Companies
            </Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">About</h2>
            <p className="text-gray-600 whitespace-pre-wrap">{company.description}</p>
          </Card>

          {/* Open Positions */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Open Positions</h2>
            </div>
            {jobsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : jobs.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No open positions currently listed</p>
            ) : (
              <div className="space-y-2">
                {jobs.map((job) => (
                  <Link key={job.id} to={`/jobs/${job.id}`} className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{job.title}</p>
                        <p className="text-sm text-gray-500">{job.location} · {job.type?.replace("_", " ")}</p>
                      </div>
                      {job.matchScore && (
                        <span className="text-xs px-2 py-1 bg-primary-50 text-primary-600 rounded-full">{job.matchScore}% match</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h2>
            <div className="space-y-3">
              {company.founded && (
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Founded</span>
                  <span className="font-medium">{company.founded}</span>
                </div>
              )}
              {company.employeeCount && (
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Employees</span>
                  <span className="font-medium">{company.employeeCount.toLocaleString()}</span>
                </div>
              )}
              {company.revenue && (
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Revenue</span>
                  <span className="font-medium">{company.revenue}</span>
                </div>
              )}
              {company.type && (
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Type</span>
                  <span className="font-medium">{company.type}</span>
                </div>
              )}
              {company.headquarters && (
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">HQ</span>
                  <span className="font-medium">{company.headquarters}</span>
                </div>
              )}
              {company.ceo && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-500">CEO</span>
                  <span className="font-medium">{company.ceo}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Salary Ranges */}
          {company.salaryRanges && company.salaryRanges.length > 0 && (
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Salary Ranges</h2>
        <div className="space-y-3">
          {company.salaryRanges.slice(0, 8).map((s: SalaryRange, i: number) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium text-gray-900">{s.role}</p>
                    <p className="text-sm text-gray-500">{s.min.toLocaleString()} - {s.max.toLocaleString()} {s.currency || "USD"}</p>
                    {s.equity && <p className="text-xs text-green-600 mt-1">Equity: {s.equity}</p>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Interview Insights */}
          {company.interviewInsights && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Interview Insights</h2>
              <div className="space-y-3">
                {company.interviewInsights.difficulty && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Difficulty</span>
                    <span className="font-medium">{company.interviewInsights.difficulty}/5</span>
                  </div>
                )}
                {company.interviewInsights.process && (
                  <div>
                    <p className="text-gray-500 text-sm mb-2">Process</p>
                    <div className="flex flex-wrap gap-1">
                      {company.interviewInsights.process.map((step: string, i: number) => (
                        <span key={i} className="px-2 py-1 bg-primary-50 text-primary-600 rounded text-xs">{step}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Actions */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
            <div className="space-y-2">
              <Link to={`/jobs?company=${id}`} className="block">
                <Button variant="outline" className="w-full justify-start">Browse All Jobs</Button>
              </Link>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/saved-searches")}>
                Create Job Alert
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/companies")}>
                Compare Companies
              </Button>
              <Link to="/companies" className="block">
                <Button variant="ghost" className="w-full justify-start">Back to Companies</Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
