import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import type { SharedReport, SharedFeedback, GeneratedResume } from "types";
import { ResumePreview } from "~/components/ResumePreview";
import { api, getUploadUrl } from "~/lib/api";
import { normalizeFeedback } from "~/lib/utils";
import { PageShell, Button, Input, Textarea, useToastHelpers, ScoreBadge, CategoryScore, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Shared Resume" },
  { name: "description", content: "Shared resume preview" },
];

export default function Share() {
  const { token } = useParams();
  const [report, setReport] = useState<SharedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  // Feedback form
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadReport() {
      if (!token) return;
      try {
        const data = await api.share.getReport(token);
        setReport(data);
      } catch {
        setError("This resume is not available or the link has expired.");
      }
      setLoading(false);
    }
    loadReport();
  }, [token]);

  async function handleSubmitFeedback() {
    if (!token || !feedbackName.trim() || !feedbackComment.trim()) return;
    setSubmitting(true);
    try {
      const result = await api.share.submitFeedback(token, {
        name: feedbackName.trim(),
        comment: feedbackComment.trim(),
        rating: feedbackRating ?? undefined,
      });
      setReport((prev) => prev ? { ...prev, sharedFeedbacks: [...(prev.sharedFeedbacks || []), result] } : prev);
      setFeedbackName("");
      setFeedbackComment("");
      setFeedbackRating(null);
      toastSuccess("Feedback submitted", "Thank you for your feedback!");
    } catch (err) {
      reportError(err, { title: "Feedback failed", toastError, retry: handleSubmitFeedback });
    }
    setSubmitting(false);
  }

  const feedback = report?.feedback ? normalizeFeedback(report.feedback) : null;
  const content = report?.generatedContent as GeneratedResume | undefined;

  return (
    <PageShell className="min-h-screen" maxWidth="2xl" padding="lg">
      <header className="flex justify-between items-center mb-8 pb-4 border-b border-gray-200">
        <Link to="/" className="font-bold text-xl text-gray-900 tracking-tight">Career Autopilot</Link>
        <span className="text-xs font-medium px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">Shared Resume</span>
      </header>

      {loading && (
        <div className="flex flex-col items-center justify-center py-24">
          <img src="/images/resume-scan-2.gif" className="w-[200px]" alt="Loading" />
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center gap-6 py-24 text-center">
          <ErrorBanner error={error} className="max-w-md" />
          <Link to="/"><Button>Go to Career Autopilot</Button></Link>
        </div>
      )}

      {report && !loading && (
        <div className="w-full flex flex-col gap-8 animate-in fade-in duration-700">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{report.jobTitle || "Resume"}</h1>
            {report.companyName && <p className="text-sm text-gray-500 mt-1">Target: {report.companyName}</p>}
          </div>

          {/* ATS Score Summary */}
          {feedback && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">ATS analysis</h2>
              <div className="grid grid-cols-3 gap-4">
                <CategoryScore label="Overall" score={feedback.overallScore} showBar={false} />
                <CategoryScore label="Keywords" score={feedback.keywordMatchScore ?? 0} showBar={false} />
                <CategoryScore label="Format" score={feedback.formatScore ?? 0} showBar={false} />
              </div>
            </div>
          )}

          {/* Resume Preview */}
          {content ? (
            <div className="bg-white border border-gray-200 shadow-sm overflow-hidden p-8 md:p-10 lg:p-12">
              <ResumePreview
                content={content}
                resumeTitle={report.jobTitle || "Resume"}
                companyName={report.companyName || undefined}
              />
            </div>
          ) : report.imagePath ? (
            <div className="panel-soft w-full max-w-sm mx-auto">
              <img src={getUploadUrl(`/uploads/images/${report.imagePath}`)} className="w-full h-auto object-contain rounded-2xl" alt="Resume preview" />
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500">
              No resume content available for preview.
            </div>
          )}

          {/* Feedback Form */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Leave Feedback</h2>
            <p className="text-sm text-gray-500 mb-4">Help improve this resume by sharing your thoughts.</p>
            <div className="space-y-4">
              <Input
                label="Your Name"
                value={feedbackName}
                onChange={(e) => setFeedbackName(e.target.value)}
                placeholder="e.g. Jane Smith"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rating (optional)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setFeedbackRating(feedbackRating === n ? null : n)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                        feedbackRating === n
                          ? "bg-primary-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                label="Your Feedback"
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                rows={4}
                placeholder="What do you think about this resume? Any suggestions for improvement?"
              />
              <Button
                onClick={handleSubmitFeedback}
                disabled={submitting || !feedbackName.trim() || !feedbackComment.trim()}
              >
                {submitting ? "Submitting..." : "Submit Feedback"}
              </Button>
            </div>
          </div>

          {/* Existing Feedbacks */}
          {report.sharedFeedbacks && report.sharedFeedbacks.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Feedback ({report.sharedFeedbacks.length})</h2>
              <div className="space-y-4">
                {report.sharedFeedbacks.map((fb) => (
                  <div key={fb.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm text-gray-900">{fb.name}</span>
                      {fb.rating && (
                        <span className="text-xs text-amber-600">{"★".repeat(fb.rating)}{"☆".repeat(5 - fb.rating)}</span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">{new Date(fb.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-gray-700">{fb.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="bg-[#FFF8F0] rounded-2xl p-8 border border-[#E8DDD1] text-center flex flex-col items-center gap-4">
            <p className="text-lg font-semibold text-gray-900">Want to create your own resume?</p>
            <p className="text-sm text-gray-600 max-w-md">
              Get resume scoring, tailoring, interview prep, and application tracking, free to start.
            </p>
            <Link to="/register"><Button>Get Started →</Button></Link>
          </div>
        </div>
      )}
    </PageShell>
  );
}
