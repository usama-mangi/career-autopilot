import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import type { Resume, SalaryRangeResult, SalaryEstimatedRange } from "types";
import { PageShell, PageHeader, Button, Input, Card, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Salary Range Estimation" },
  { name: "description", content: "Estimate salary range based on your resume and market data" },
];

const confidenceConfig = {
  high: { label: "High Confidence", class: "bg-green-100 text-green-700 border-green-200" },
  medium: { label: "Medium Confidence", class: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  low: { label: "Low Confidence", class: "bg-red-100 text-red-700 border-red-200" },
};

const marketLevelConfig = {
  "below-market": { label: "Below Market", class: "bg-orange-100 text-orange-700" },
  market: { label: "At Market Rate", class: "bg-green-100 text-green-700" },
  "above-market": { label: "Above Market", class: "bg-blue-100 text-blue-700" },
};

function formatCurrency(value: number, symbol: string) {
  if (value >= 1000) {
    return `${symbol}${(value / 1000).toFixed(0)}k`;
  }
  return `${symbol}${value.toLocaleString()}`;
}

export default function SalaryEstimate() {
  const { id } = useParams();
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { error: toastError } = useToastHelpers();

  const [resume, setResume] = useState<Resume | null>(null);
  const [loadingResume, setLoadingResume] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<SalaryRangeResult | null>(null);
  const [error, setError] = useState("");
  const [targetLocation, setTargetLocation] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [targetIndustry, setTargetIndustry] = useState("");

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate(`/login`);
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    async function loadResume() {
      if (!id) return;
      try {
        const [data, cachedResult] = await Promise.all([
          api.resumes.get(id),
          api.resumes.getSalaryEstimate(id).catch(() => null),
        ]);
        setResume(data);
        if (cachedResult) setResult(cachedResult);
      } catch (err) {
        console.error("Failed to load resume:", err);
      }
      setLoadingResume(false);
    }
    loadResume();
  }, [id]);

  async function handleEstimate() {
    if (!resume || !id) return;
    setGenerating(true);
    setError("");
    setResult(null);
    try {
      const parsed = await api.resumes.salaryEstimate(id, {
        targetLocation: targetLocation || undefined,
        yearsOfExperience: yearsOfExperience || undefined,
        targetIndustry: targetIndustry || undefined,
      });
      setResult(parsed);
    } catch (err) {
      reportError(err, {
        title: "Estimation failed",
        toastError,
        setError,
        retry: handleEstimate,
      });
    }
    setGenerating(false);
  }

  const formatVal = (val: number) => {
    if (!result) return "";
    return formatCurrency(val, result.currencySymbol);
  };

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Salary Range Estimation"
        subtitle={
          !generating && !result
            ? "Estimate your market value based on your resume and job profile."
            : generating
              ? "Analyzing market data..."
              : "Your salary estimate is ready!"
        }
      />

      {loadingResume && (
        <div className="flex flex-col items-center justify-center py-12">
          <img src="/images/resume-scan-2.gif" className="w-[200px]" />
        </div>
      )}

      {!loadingResume && !resume && (
        <div className="flex flex-col items-center gap-4 mt-8">
          <p className="text-lg text-gray-500">Resume not found.</p>
          <Link to="/upload"><Button>Upload a Resume</Button></Link>
        </div>
      )}

      {!loadingResume && resume && !result && !generating && (
        <div className="w-full max-w-xl flex flex-col gap-4">
          <Input
            label="Job Title"
            value={resume.jobTitle || ""}
            disabled
            className="text-gray-500 bg-gray-50"
          />
          <Input
            label="Target Location (optional)"
            placeholder="e.g. San Francisco, Remote US, London"
            value={targetLocation}
            onChange={(e) => setTargetLocation(e.target.value)}
          />
          <Input
            label="Years of Experience (optional)"
            placeholder="e.g. 5 years"
            value={yearsOfExperience}
            onChange={(e) => setYearsOfExperience(e.target.value)}
          />
          <Input
            label="Industry (optional)"
            placeholder="e.g. Fintech, Healthcare, SaaS"
            value={targetIndustry}
            onChange={(e) => setTargetIndustry(e.target.value)}
          />
          <Button onClick={handleEstimate}>Estimate Salary Range</Button>
        </div>
      )}

      {generating && (
        <div className="flex flex-col items-center gap-6 mt-8">
          <img src="/images/resume-scan.gif" className="w-64" />
          <p className="text-sm text-gray-500 animate-pulse">Analyzing market data and your profile...</p>
        </div>
      )}

      {error && <ErrorBanner error={error} onRetry={handleEstimate} className="w-full max-w-4xl" />}

      {result && !generating && (
        <div className="w-full max-w-4xl flex flex-col gap-6 animate-in fade-in duration-1000">
          <div className="flex flex-row gap-3 justify-end">
            <Link to={`/resumes/${id}`} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Back to Review
            </Link>
          </div>

          <Card>
            <div className="flex flex-row items-center gap-6 mb-6 flex-wrap">
              <div className="flex flex-col items-center">
                <div className="text-3xl font-bold text-gray-900">{formatVal(result.estimatedRange.p50)}</div>
                <p className="text-xs text-gray-500 mt-1">Median {result.period === "yearly" ? "/ Year" : result.period === "monthly" ? "/ Month" : "/ Hour"}</p>
              </div>
              <div className="flex-1 min-w-[200px]">
                <p className="text-gray-700 leading-relaxed text-sm">{result.summary}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className={cn("text-xs font-medium px-2.5 py-0.5 rounded-full border text-center", confidenceConfig[result.confidence].class)}>{confidenceConfig[result.confidence].label}</span>
                <span className={cn("text-xs font-medium px-2.5 py-0.5 rounded-full text-center", marketLevelConfig[result.marketLevel].class)}>{marketLevelConfig[result.marketLevel].label}</span>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mb-4">Salary Percentiles</h3>
            <div className="grid grid-cols-5 gap-3 mb-6">
              {([
                { label: "10th", key: "p10", color: "bg-blue-100 text-blue-700" },
                { label: "25th", key: "p25", color: "bg-blue-200 text-blue-800" },
                { label: "50th", key: "p50", color: "bg-green-200 text-green-800" },
                { label: "75th", key: "p75", color: "bg-yellow-200 text-yellow-800" },
                { label: "90th", key: "p90", color: "bg-orange-200 text-orange-800" },
              ] as const).map(({ label, key, color }) => (
                <div key={key} className={cn("rounded-xl p-4 text-center", color)}>
                  <div className="text-lg font-bold">{formatVal(result.estimatedRange[key as keyof SalaryEstimatedRange] as number)}</div>
                  <div className="text-xs opacity-75 mt-0.5">{label} Percentile</div>
                </div>
              ))}
            </div>

            {result.factors.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Key Factors</h3>
                <div className="flex flex-wrap gap-2">
                  {result.factors.map((factor, i) => (
                    <span key={i} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium">{factor}</span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {result.locationAdjustments && result.locationAdjustments.length > 0 && (
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Location Adjustments</h3>
              <div className="flex flex-col gap-3">
                {result.locationAdjustments.map((adj, i) => (
                  <div key={i} className="flex flex-row items-center gap-4 p-4 bg-gray-50 rounded-xl flex-wrap">
                    <div className="font-medium text-gray-900 min-w-[130px]">{adj.location}</div>
                    <div className="text-sm text-gray-500 min-w-[100px]">{adj.adjustment}</div>
                    <div className="flex gap-2 text-xs font-medium ml-auto">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">P10: {formatCurrency(adj.range.p10, result.currencySymbol)}</span>
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded">P50: {formatCurrency(adj.range.p50, result.currencySymbol)}</span>
                      <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded">P90: {formatCurrency(adj.range.p90, result.currencySymbol)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Button onClick={handleEstimate}>Re-estimate</Button>
        </div>
      )}
    </PageShell>
  );
}
