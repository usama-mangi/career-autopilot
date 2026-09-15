import type { ExternalJobPosting } from "types";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { PageShell, PageHeader, Button, Card, Input } from "~/components/ui";
import { Skeleton } from "~/components/Skeleton";

export const meta = () => [
  { title: "Career Autopilot | Companies" },
  { name: "description", content: "Research companies before you apply" },
];

const SOURCES = [
  { value: "linkedin", label: "LinkedIn", color: "bg-info-50 text-info" },
  { value: "indeed", label: "Indeed", color: "bg-info-50 text-info-700" },
  { value: "glassdoor", label: "Glassdoor", color: "bg-success-50 text-success-700" },
  { value: "jsearch", label: "JSearch", color: "bg-warning-50 text-warning-700" },
  { value: "company", label: "Company Site", color: "bg-gray-100 text-gray-600" },
];

export default function Companies() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    async function load() {
      setLoading(true);
      try {
        // Use jobs search with company names to find companies
        const data = await api.jobs.search({ keywords: searchQuery, page, limit: 20 } as any);
        // Extract unique companies from jobs
        const companyMap = new Map();
        (data.jobs || []).forEach((job: ExternalJobPosting) => {
          if (job.company && !companyMap.has(job.company)) {
            companyMap.set(job.company, {
              id: job.companyId || job.company.toLowerCase().replace(/\s+/g, "-"),
              name: job.company,
              industry: job.industry || "Technology",
              size: job.companySize,
              location: job.location,
              rating: job.companyRating,
              reviewCount: job.companyReviewCount,
              logoUrl: job.companyLogo,
              sources: ["jsearch"],
            });
          }
        });
        const items = Array.from(companyMap.values());
        setCompanies(page === 1 ? items : [...companies, ...items]);
        setHasMore(items.length >= 20);
      } catch (err) {
        console.error("Failed to load companies:", err);
      }
      setLoading(false);
    }
    load();
  }, [searchQuery, page, isAuthenticated]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 100 && hasMore && !loading) {
      setPage((p) => p + 1);
    }
  }

  if (loading && companies.length === 0) {
    return (
      <PageShell>
        <PageHeader title="Companies" subtitle="Loading..." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Company Research"
        subtitle="Research companies before you apply — ratings, reviews, salaries, and more"
        action={
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="w-64"
            />
          </div>
        }
      />

      <div onScroll={handleScroll} className="h-[calc(100vh-280px)] overflow-y-auto pr-2">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <Link key={company.id} to={`/companies/${company.id}`} className="block">
              <Card hover className="h-full flex flex-col">
                <div className="flex items-start gap-3 mb-3">
                  <div className="size-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {company.logoUrl ? (
                      <img src={company.logoUrl} alt={company.name} className="size-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-gray-500">{company.name?.[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{company.name}</h3>
                    <p className="text-sm text-gray-500 truncate">{company.industry || "Technology"}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {company.sources?.slice(0, 3).map((s: string) => {
                        const src = SOURCES.find((x) => x.value === s);
                        return src ? (
                          <span key={s} className={`text-xs px-2 py-0.5 rounded-full ${src.color}`}>{src.label}</span>
                        ) : null;
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex-1 flex flex-col justify-end border-t pt-3">
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    {company.rating && (
                      <span className="flex items-center gap-1">
                        <svg className="size-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        {company.rating.toFixed(1)}
                      </span>
                    )}
                    {company.reviewCount && (
                      <span>{company.reviewCount.toLocaleString()} reviews</span>
                    )}
                    {company.size && (
                      <span>{company.size}</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button variant="outline" size="sm" className="flex-1">View Details</Button>
                    <Button size="sm" onClick={(e) => { e.preventDefault(); navigate(`/jobs?company=${company.id}`); }}>Jobs</Button>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {hasMore && (
          <div className="text-center py-4">
            {loading ? (
              <Button variant="outline" disabled>Loading more...</Button>
            ) : (
              <p className="text-sm text-gray-500">Scroll for more companies</p>
            )}
          </div>
        )}
      </div>

      {companies.length === 0 && !loading && (
        <Card className="text-center py-12">
          <p className="text-gray-500 mb-4">No companies found matching "{searchQuery}"</p>
          <Button variant="outline" onClick={() => setSearchQuery("")}>Clear Search</Button>
        </Card>
      )}
    </PageShell>
  );
}