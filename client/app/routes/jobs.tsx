import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { useJobsStore } from "~/lib/jobs-store";
import { PageShell, PageHeader, Button, Input, Card, Modal, ModalFooter, useToastHelpers, ScoreBadge } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Job Search" },
  { name: "description", content: "Search jobs across LinkedIn, Indeed, Glassdoor, and company career pages" },
];

const SOURCES = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "indeed", label: "Indeed" },
  { value: "glassdoor", label: "Glassdoor" },
  { value: "company", label: "Company Career Pages" },
];

const JOB_TYPES = [
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
];

const REMOTE_TYPES = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

const EXPERIENCE_LEVELS = [
  { value: "entry", label: "Entry Level" },
  { value: "mid", label: "Mid Level" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead/Principal" },
  { value: "executive", label: "Executive" },
];

const JOB_FUNCTIONS = [
  { value: "frontend", label: "Frontend" },
  { value: "backend", label: "Backend" },
  { value: "full-stack", label: "Full-Stack" },
  { value: "mobile", label: "Mobile" },
  { value: "ml-ai", label: "ML/AI" },
  { value: "data", label: "Data" },
  { value: "devops", label: "DevOps" },
  { value: "security", label: "Security" },
  { value: "cloud", label: "Cloud" },
  { value: "qa", label: "QA/Testing" },
];

const TABS = [
  { key: "search" as const, label: "Search" },
  { key: "bookmarked" as const, label: "Bookmarked" },
  { key: "saved" as const, label: "Saved Searches" },
  { key: "matches" as const, label: "AI Matches" },
];

export default function JobsPage() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const store = useJobsStore();
  const searchAbortRef = useRef<AbortController | null>(null);
  const [bookmarkedJobs, setBookmarkedJobs] = useState<any[]>([]);
  const [loadingBookmarked, setLoadingBookmarked] = useState(true);

  const activeFilterCount =
    store.selectedSources.length +
    store.selectedJobTypes.length +
    store.selectedRemoteTypes.length +
    store.selectedExperienceLevels.length +
    store.selectedJobFunctions.length;

  // Saved search form
  const [showNewSearchForm, setShowNewSearchForm] = useState(false);
  const [newSearchName, setNewSearchName] = useState("");
  const [newSearchKeywords, setNewSearchKeywords] = useState("");
  const [newSearchLocation, setNewSearchLocation] = useState("");

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      store.loadResumes();
      store.loadSavedSearches();
      loadBookmarkedJobs();
    }
  }, [isAuthenticated]);

  // Compute matching jobs when scores or jobs change
  useEffect(() => {
    if (
      store.activeTab === "matches" &&
      store.jobs.length > 0 &&
      Object.keys(store.matchScores).length > 0
    ) {
      useJobsStore.setState({
        matchingJobs: store.jobs.filter(
          (j: any) => (store.matchScores[j.id] || 0) > 0
        ),
      });
    }
  }, [store.matchScores, store.jobs, store.activeTab]);

  // Trigger batch match when switching to matches tab
  useEffect(() => {
    if (
      store.activeTab === "matches" &&
      store.hasSearched &&
      store.resumes.length > 0 &&
      store.jobs.length > 0 &&
      Object.keys(store.matchScores).length === 0
    ) {
      const jobIds = store.jobs.map((j: any) => j.id);
      Promise.all(
        store.resumes.map(async (resume: any) => {
          const matches = await api.jobs.batchMatch(jobIds, resume.id);
          return { resumeId: resume.id, resumeTitle: resume.jobTitle, matches };
        })
      ).then((results) => {
        const matchMap: Record<string, number> = {};
        results.forEach((r) => {
          r.matches.forEach((m: any, index: number) => {
            const jobId = jobIds[index];
            matchMap[jobId] = Math.max(matchMap[jobId] || 0, m.overallMatch);
          });
        });
        useJobsStore.setState({ matchScores: matchMap });
      });
    }
  }, [store.activeTab]);

  // Reload bookmarked jobs whenever the bookmarked tab is selected
  useEffect(() => {
    if (isAuthenticated && store.activeTab === "bookmarked") {
      loadBookmarkedJobs();
    }
  }, [store.activeTab, isAuthenticated]);

  async function loadBookmarkedJobs() {
    setLoadingBookmarked(true);
    try {
      const data = await api.jobs.list({ isBookmarked: true, limit: 50 });
      setBookmarkedJobs(data.jobs || []);
    } catch (err) {
      console.error("Failed to load bookmarked jobs:", err);
    }
    setLoadingBookmarked(false);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    searchAbortRef.current?.abort();
    searchAbortRef.current = new AbortController();
    await store.search();
  }

  async function handleRunSavedSearch(search: any) {
    store.setSearchKeywords(
      Array.isArray(search.keywords) ? search.keywords.join(", ") : ""
    );
    store.setSearchLocation(search.location || "");
    store.setSelectedSources(search.sources || []);
    store.setSelectedJobTypes(search.jobTypes || []);
    store.setSelectedRemoteTypes(search.remoteTypes || []);
    store.setSelectedExperienceLevels(search.experienceLevels || []);
    store.setActiveTab("search");
    await store.search();
  }

  async function handleDeleteSavedSearch(id: string) {
    if (!confirm("Delete this saved search?")) return;
    try {
      await api.jobs.savedSearches.delete(id);
      toastSuccess("Deleted", "Saved search removed");
      store.loadSavedSearches();
    } catch (err) {
      toastError(
        "Delete failed",
        err instanceof Error ? err.message : "Unknown error"
      );
    }
  }

  async function handleCreateSavedSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!newSearchName || !newSearchKeywords) return;
    try {
      await api.jobs.savedSearches.create({
        name: newSearchName,
        keywords: newSearchKeywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        location: newSearchLocation || undefined,
        sources:
          store.selectedSources.length > 0 ? store.selectedSources : undefined,
        jobTypes:
          store.selectedJobTypes.length > 0
            ? store.selectedJobTypes
            : undefined,
        remoteTypes:
          store.selectedRemoteTypes.length > 0
            ? store.selectedRemoteTypes
            : undefined,
        experienceLevels:
          store.selectedExperienceLevels.length > 0
            ? store.selectedExperienceLevels
            : undefined,
      });
      setShowNewSearchForm(false);
      setNewSearchName("");
      setNewSearchKeywords("");
      setNewSearchLocation("");
      toastSuccess("Search saved", "Your job search has been saved");
      store.loadSavedSearches();
    } catch (err) {
      toastError(
        "Failed to save search",
        err instanceof Error ? err.message : "Unknown error"
      );
    }
  }

  if (isPending) {
    return (
      <PageShell>
        <div className="space-y-6">
          <div className="h-10 w-48 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </PageShell>
    );
  }

  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  const displayedJobs =
    store.activeTab === "matches" ? store.matchingJobs : store.jobs;

  return (
    <PageShell maxWidth="full" padding="lg">
      {/* Hero search area */}
      <div className="bg-[#FFF8F0] border border-[#E8DDD1] rounded-2xl p-6 sm:p-8 mb-8 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary-500" />
          </span>
          <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Live search</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-2">
          Scout your next role
        </h1>
        <p className="text-base text-gray-500 mb-6 max-w-xl">
          Pull opportunities from LinkedIn, Indeed, Glassdoor, and company career pages into one field.
        </p>
        <form onSubmit={handleSearch} className="flex items-end gap-3">
          <div className="flex-1 min-w-0">
            <Input
              label="Keywords"
              placeholder="Job title, skills, or company"
              value={store.searchKeywords}
              onChange={(e) => store.setSearchKeywords(e.target.value)}
            />
          </div>
          <div className="w-48 shrink-0">
            <Input
              label="Location"
              placeholder="City or remote"
              value={store.searchLocation}
              onChange={(e) => store.setSearchLocation(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            className="shrink-0 h-[38px]"
            disabled={store.loadingJobs}
          >
            {store.loadingJobs ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Searching
              </span>
            ) : (
              "Search Jobs"
            )}
          </Button>
        </form>
      </div>

      {/* Filters row + actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {/* Filters toggle */}
          <button
            type="button"
            onClick={() => store.setFiltersOpen(!store.filtersOpen)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-500 text-white text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => {
                store.setSelectedSources([]);
                store.setSelectedJobTypes([]);
                store.setSelectedRemoteTypes([]);
                store.setSelectedExperienceLevels([]);
                store.setSelectedJobFunctions([]);
              }}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Save search button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowNewSearchForm(true)}
        >
          Save This Search
        </Button>
      </div>

      {/* Collapsible filters */}
      {store.filtersOpen && (
        <Card className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            <FilterGroup
              title="Sources"
              options={SOURCES}
              selected={store.selectedSources}
              onChange={store.setSelectedSources}
            />
            <FilterGroup
              title="Job Type"
              options={JOB_TYPES}
              selected={store.selectedJobTypes}
              onChange={store.setSelectedJobTypes}
            />
            <FilterGroup
              title="Work Style"
              options={REMOTE_TYPES}
              selected={store.selectedRemoteTypes}
              onChange={store.setSelectedRemoteTypes}
            />
            <FilterGroup
              title="Experience"
              options={EXPERIENCE_LEVELS}
              selected={store.selectedExperienceLevels}
              onChange={store.setSelectedExperienceLevels}
            />
            <FilterGroup
              title="Function"
              options={JOB_FUNCTIONS}
              selected={store.selectedJobFunctions}
              onChange={store.setSelectedJobFunctions}
            />
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div role="tablist" className="flex items-center gap-1 mb-6 border-b border-[#E8DDD1]" aria-label="Job search views">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            onClick={() =>
              store.setActiveTab(
                tab.key as "search" | "saved" | "matches" | "bookmarked"
              )
            }
            aria-selected={store.activeTab === tab.key}
            aria-controls={`jobs-tabpanel-${tab.key}`}
            id={`jobs-tab-${tab.key}`}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all duration-200 -mb-px ${
              store.activeTab === tab.key
                ? "border-primary-500 text-primary-600 bg-[#FFF8F0] rounded-t-lg"
                : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search tab content */}
      {store.activeTab === "search" && (
        <div role="tabpanel" id="jobs-tabpanel-search" aria-labelledby="jobs-tab-search" className="animate-in fade-in duration-150">
          {store.loadingJobs ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-56 bg-gray-100 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : displayedJobs.length === 0 && !store.hasSearched ? (
            /* No search yet - show bookmarked jobs or empty state */
            loadingBookmarked ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-48 bg-gray-100 rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : bookmarkedJobs.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                    Bookmarked Jobs
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadBookmarkedJobs}
                  >
                    Refresh
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {bookmarkedJobs.map((job: any) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              </div>
            ) : (
              <Card className="text-center py-16 bg-[#FFF8F0] border-[#E8DDD1]">
                <div className="w-16 h-16 rounded-full bg-primary-50 border-2 border-primary-200 flex items-center justify-center mx-auto mb-5">
                  <svg
                    className="w-8 h-8 text-primary-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                    />
                  </svg>
                </div>
                <p className="text-lg font-bold text-gray-900 mb-1.5">
                  Start your search
                </p>
                <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto leading-relaxed">
                  Enter keywords and location to discover opportunities across multiple job boards.
                </p>
              </Card>
            )
          ) : displayedJobs.length === 0 ? (
            <Card className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-[#F5EDE4] border-2 border-[#E8DDD1] flex items-center justify-center mx-auto mb-5">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
              </div>
              <p className="text-lg font-bold text-gray-900 mb-1.5">
                No results for these filters
              </p>
              <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
                Try broadening your keywords, removing location, or relaxing experience level filters.
              </p>
            </Card>
          ) : (
            <>
              {/* Results count */}
              <p className="text-sm text-gray-500 mb-4">
                {store.pagination.total.toLocaleString()} job
                {store.pagination.total !== 1 ? "s" : ""} found
              </p>

              {/* Job grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
                {displayedJobs.map((job: any) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>

              {/* Pagination */}
              {store.pagination.totalPages > 1 &&
                (() => {
                  const { page, totalPages } = store.pagination;
                  const pages: (number | "...")[] = [];
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (page > 3) pages.push("...");
                    for (
                      let i = Math.max(2, page - 1);
                      i <= Math.min(totalPages - 1, page + 1);
                      i++
                    )
                      pages.push(i);
                    if (page < totalPages - 2) pages.push("...");
                    pages.push(totalPages);
                  }
                  return (
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => store.goPage(page - 1)}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      {pages.map((p, i) =>
                        p === "..." ? (
                          <span
                            key={`e${i}`}
                            className="px-2 text-gray-400"
                          >
                            ...
                          </span>
                        ) : (
                          <Button
                            key={p}
                            variant={p === page ? "primary" : "ghost"}
                            size="sm"
                            onClick={() => store.goPage(p)}
                            className="min-w-[2rem]"
                          >
                            {p}
                          </Button>
                        )
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => store.goPage(page + 1)}
                        disabled={page === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  );
                })()}
            </>
          )}
        </div>
      )}

      {/* Bookmarked tab */}
      {store.activeTab === "bookmarked" && (
        <div role="tabpanel" id="jobs-tabpanel-bookmarked" aria-labelledby="jobs-tab-bookmarked" className="animate-in fade-in duration-150">
          {loadingBookmarked ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-48 bg-gray-100 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : bookmarkedJobs.length === 0 ? (
            <Card className="text-center py-16 bg-[#FFF8F0] border-[#E8DDD1]">
              <div className="w-16 h-16 rounded-full bg-primary-50 border-2 border-primary-200 flex items-center justify-center mx-auto mb-5">
                <svg
                  className="w-8 h-8 text-primary-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                  />
                </svg>
              </div>
              <p className="text-lg font-bold text-gray-900 mb-1.5">
                No bookmarks yet
              </p>
              <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto leading-relaxed">
                Bookmark jobs from search results to save them for later comparison.
              </p>
              <Button variant="secondary" size="sm" onClick={() => store.setActiveTab("search")}>
                Browse Jobs
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {bookmarkedJobs.map((job: any) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Saved searches tab */}
      {store.activeTab === "saved" && (
        <div role="tabpanel" id="jobs-tabpanel-saved" aria-labelledby="jobs-tab-saved" className="animate-in fade-in duration-150">
          {store.loadingSavedSearches ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-32 bg-gray-100 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : store.savedSearches.length === 0 ? (
            <Card className="text-center py-16 bg-[#FFF8F0] border-[#E8DDD1]">
              <div className="w-16 h-16 rounded-full bg-primary-50 border-2 border-primary-200 flex items-center justify-center mx-auto mb-5">
                <svg
                  className="w-8 h-8 text-primary-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
                  />
                </svg>
              </div>
              <p className="text-lg font-bold text-gray-900 mb-1.5">
                No saved searches yet
              </p>
              <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto leading-relaxed">
                Save a search to get alerts when new matching jobs are posted.
              </p>
              <Button onClick={() => setShowNewSearchForm(true)}>
                Create Your First Search
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {store.savedSearches.map((search) => (
                <Card key={search.id}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-gray-900 truncate">
                        {search.name}
                      </h4>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {search.keywords?.join(", ") || "All keywords"}
                        {search.location && ` in ${search.location}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleRunSavedSearch(search)}
                      >
                        Run Search
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSavedSearch(search.id)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Matches tab */}
      {store.activeTab === "matches" && (
        <div role="tabpanel" id="jobs-tabpanel-matches" aria-labelledby="jobs-tab-matches" className="animate-in fade-in duration-150">
          {store.resumes.length === 0 ? (
            <Card className="text-center py-16 bg-[#FFF8F0] border-[#E8DDD1]">
              <div className="w-16 h-16 rounded-full bg-primary-50 border-2 border-primary-200 flex items-center justify-center mx-auto mb-5">
                <svg
                  className="w-8 h-8 text-primary-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                  />
                </svg>
              </div>
              <p className="text-lg font-bold text-gray-900 mb-1.5">
                Upload a resume to enable AI matching
              </p>
              <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto leading-relaxed">
                Your resume is compared against job descriptions to surface the best-fit roles.
              </p>
              <Button
                variant="secondary"
                onClick={() => navigate("/resumes")}
              >
                Go to Resumes
              </Button>
            </Card>
          ) : store.matchingJobs.length === 0 && !store.loadingJobs ? (
            <Card className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-[#F5EDE4] border-2 border-[#E8DDD1] flex items-center justify-center mx-auto mb-5">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
              </div>
              <p className="text-lg font-bold text-gray-900 mb-1.5">
                No matches found
              </p>
              <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto leading-relaxed">
                Try searching with broader keywords to generate AI match scores against your resume.
              </p>
              <Button
                variant="secondary"
                onClick={() => store.setActiveTab("search")}
              >
                Search Jobs
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {store.matchingJobs.map((job: any) => (
                <JobCard
                  key={job.id}
                  job={job}
                  matchScore={store.matchScores[job.id]}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save Search Modal */}
      <Modal
        isOpen={showNewSearchForm}
        onClose={() => setShowNewSearchForm(false)}
        title="Save This Search"
        size="md"
      >
        <form onSubmit={handleCreateSavedSearch} className="space-y-4">
          <Input
            label="Search Name"
            placeholder="e.g. Remote React Jobs"
            value={newSearchName}
            onChange={(e) => setNewSearchName(e.target.value)}
            required
          />
          <Input
            label="Keywords"
            placeholder="e.g. React, TypeScript"
            value={newSearchKeywords}
            onChange={(e) => setNewSearchKeywords(e.target.value)}
            required
          />
          <Input
            label="Location (optional)"
            placeholder="e.g. Remote, San Francisco"
            value={newSearchLocation}
            onChange={(e) => setNewSearchLocation(e.target.value)}
          />
          <ModalFooter
            actions={[
              {
                label: "Cancel",
                variant: "secondary",
                onClick: () => setShowNewSearchForm(false),
              },
              {
                label: "Save Search",
                variant: "primary",
                onClick: handleCreateSavedSearch,
              },
            ]}
          />
        </form>
      </Modal>
    </PageShell>
  );
}

// ─── Filter group component ────────────────────────────────────────────────

function FilterGroup({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all duration-150 ${
              selected.includes(opt.value)
                ? "bg-primary-50 text-primary-700 ring-1 ring-primary-200 shadow-sm"
                : "bg-[#F5EDE4] text-gray-600 hover:bg-[#E8DDD1]"
            }`}
          >
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={(e) =>
                e.target.checked
                  ? onChange([...selected, opt.value])
                  : onChange(selected.filter((v) => v !== opt.value))
              }
              className="sr-only"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Source color mapping ──────────────────────────────────────────────────

const SOURCE_STYLES: Record<
  string,
  { bg: string; text: string; border: string; dot: string; color: string }
> = {
  linkedin: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-l-blue-500",
    dot: "bg-blue-500",
    color: "#3b82f6",
  },
  indeed: {
    bg: "bg-[#FFF8F0]",
    text: "text-primary-700",
    border: "border-l-primary-500",
    dot: "bg-primary-500",
    color: "#C2410C",
  },
  glassdoor: {
    bg: "bg-[#ECFDF5]",
    text: "text-[#065F46]",
    border: "border-l-[#065F46]",
    dot: "bg-[#065F46]",
    color: "#065F46",
  },
  jsearch: {
    bg: "bg-[#FFFBEB]",
    text: "text-[#A16207]",
    border: "border-l-[#A16207]",
    dot: "bg-[#A16207]",
    color: "#A16207",
  },
  company: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-l-amber-500",
    dot: "bg-amber-500",
    color: "#f59e0b",
  },
};

// ─── Job card ─────────────────────────────────────────────────────────────

function JobCard({
  job,
  matchScore,
}: {
  job: any;
  matchScore?: number;
}) {
  const sourceStyle = SOURCE_STYLES[job.source] || SOURCE_STYLES.jsearch;
  const matchPercent = matchScore || 0;

  return (
    <Link to={`/jobs/${job.id}`} className="block group">
      <div className="h-full border border-[#E8DDD1] rounded-xl p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-1 bg-white shadow-sm" style={{ borderTopColor: sourceStyle.color, borderTopWidth: '3px' }}>
        {/* Top row: source + posted date */}
        <div className="flex items-center justify-between mb-3">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${sourceStyle.bg} ${sourceStyle.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${sourceStyle.dot}`} />
            {job.source}
          </span>
          <span className="text-[11px] text-gray-400 font-medium">
            {job.postedAt
              ? new Date(job.postedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })
              : "Recent"}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-[15px] font-bold text-gray-900 leading-snug mb-1.5 line-clamp-2 group-hover:text-primary-600 transition-colors">
          {job.title}
        </h3>

        {/* Company */}
        <p className="text-sm font-semibold text-primary-600 mb-2.5">
          {job.companyName}
        </p>

        {/* Location + type row */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
          {job.location && (
            <span className="flex items-center gap-1">
              <svg
                className="w-3.5 h-3.5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                />
              </svg>
              {job.location}
            </span>
          )}
          {job.jobType && (
            <>
              <span className="text-gray-300">|</span>
              <span className="capitalize font-medium">{job.jobType}</span>
            </>
          )}
          {job.workArrangement &&
            job.workArrangement !== job.remoteType &&
            job.workArrangement !== "unknown" && (
              <>
                <span className="text-gray-300">|</span>
                <span className="capitalize font-medium">{job.workArrangement}</span>
              </>
            )}
        </div>

        {/* Salary */}
        {job.salaryMin && (
          <p className="text-sm font-bold text-success mb-2.5">
            ${job.salaryMin.toLocaleString()} - $
            {job.salaryMax?.toLocaleString() || "N/A"}
            <span className="text-xs font-normal text-gray-400 ml-1">
              {job.salaryCurrency || "USD"}/yr
            </span>
          </p>
        )}

        {/* Tags row: seniority + function */}
        {(job.seniorityLevel || job.jobFunction) && (
          <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
            {job.seniorityLevel && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-info-50 text-info-700 capitalize">
                {job.seniorityLevel}
              </span>
            )}
            {job.jobFunction && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 capitalize">
                {job.jobFunction}
              </span>
            )}
          </div>
        )}

        {/* Technologies */}
        {job.requiredTechnologies?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {job.requiredTechnologies.slice(0, 5).map((tech: string) => (
              <span
                key={tech}
                className="px-2 py-0.5 bg-[#F5EDE4] text-gray-700 rounded-full text-[10px] font-semibold"
              >
                {tech}
              </span>
            ))}
            {job.requiredTechnologies.length > 5 && (
              <span className="px-2 py-0.5 text-gray-400 text-[10px] font-medium">
                +{job.requiredTechnologies.length - 5} more
              </span>
            )}
          </div>
        )}

        {/* Bottom row: match score + bookmark */}
        <div className="flex items-center justify-between pt-3 border-t border-[#E8DDD1] mt-auto">
          {matchPercent > 0 ? (
            <ScoreBadge score={matchPercent} size="sm" variant="compact" />
          ) : (
            <span />
          )}
          {job.isBookmarked && (
            <svg
              className="w-4.5 h-4.5 text-amber-400"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
            </svg>
          )}
        </div>
      </div>
    </Link>
  );
}
