import type { Resume } from "types";
import { Link } from "react-router";
import { cn, normalizeFeedback } from "~/lib/utils";
import ScoreBadge from "./ScoreBadge";

interface BatchComparisonProps {
  resumes: Resume[];
  previewUrls: Record<string, string>;
  jobTitle: string;
  jobDescription: string;
}

function ScoreCell({ score }: { score: number }) {
  return (
    <div
      className={cn(
        "text-center font-bold text-sm py-1.5 px-3 rounded-lg",
        score >= 70
          ? "bg-success-light text-success"
          : score >= 40
            ? "bg-warning-light text-warning"
            : "bg-danger-light text-danger",
      )}
    >
      {score}/100
    </div>
  );
}

export default function BatchComparison({
  resumes,
  previewUrls,
  jobTitle,
  jobDescription,
}: BatchComparisonProps) {
  return (
    <div className="flex flex-col gap-8">
      {/* Job Info */}
      <div className="bg-white rounded-2xl shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800">{jobTitle}</h2>
        {jobDescription && (
          <div className="mt-3">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Job Description
            </p>
            <p className="text-gray-600 text-sm whitespace-pre-wrap line-clamp-4">
              {jobDescription}
            </p>
          </div>
        )}
      </div>

      {/* Score Overview Table */}
      <div className="bg-white rounded-2xl shadow-md p-6 overflow-x-auto">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          Score Comparison
        </h3>
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 pr-4 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Category
              </th>
              {resumes.map((resume) => (
                <th
                  key={resume.id}
                  className="text-center py-3 px-3 text-sm font-semibold text-gray-500 uppercase tracking-wide"
                >
                  <span className="truncate max-w-[140px] block" title={resume.fileName}>
                    {resume.fileName || "Resume"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 pr-4 font-medium text-gray-700">Overall</td>
                        {resumes.map((resume) => {
                          const fb = normalizeFeedback(resume.feedback);
                          return (
                            <td key={resume.id} className="py-3 px-3">
                              <ScoreCell score={fb.overallScore} />
                            </td>
                          );
                        })}
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 pr-4 font-medium text-gray-700">ATS</td>
                        {resumes.map((resume) => {
                          const fb = normalizeFeedback(resume.feedback);
                          return (
                            <td key={resume.id} className="py-3 px-3">
                              <ScoreCell score={fb.ATS.score} />
                            </td>
                          );
                        })}
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 pr-4 font-medium text-gray-700">
                          Tone & Style
                        </td>
                        {resumes.map((resume) => {
                          const fb = normalizeFeedback(resume.feedback);
                          return (
                            <td key={resume.id} className="py-3 px-3">
                              <ScoreCell score={fb.toneAndStyle.score} />
                            </td>
                          );
                        })}
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 pr-4 font-medium text-gray-700">Content</td>
                        {resumes.map((resume) => {
                          const fb = normalizeFeedback(resume.feedback);
                          return (
                            <td key={resume.id} className="py-3 px-3">
                              <ScoreCell score={fb.content.score} />
                            </td>
                          );
                        })}
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 pr-4 font-medium text-gray-700">Structure</td>
                        {resumes.map((resume) => {
                          const fb = normalizeFeedback(resume.feedback);
                          return (
                            <td key={resume.id} className="py-3 px-3">
                              <ScoreCell score={fb.structure.score} />
                            </td>
                          );
                        })}
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-3 pr-4 font-medium text-gray-700">Skills</td>
                        {resumes.map((resume) => {
                          const fb = normalizeFeedback(resume.feedback);
                          return (
                            <td key={resume.id} className="py-3 px-3">
                              <ScoreCell score={fb.skills.score} />
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
        </table>
      </div>

      {/* Detailed Breakdown */}
      <div className="bg-white rounded-2xl shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          Detailed Breakdown
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resumes.map((resume) => {
            const previewUrl = previewUrls[resume.id];
            const fb = normalizeFeedback(resume.feedback);
            return (
              <div
                key={resume.id}
                className="border border-gray-200 rounded-xl p-4 flex flex-col gap-3"
              >
                {/* File name header */}
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-800 truncate" title={resume.fileName}>
                    {resume.fileName || "Resume"}
                  </p>
                  <ScoreBadge score={fb.overallScore} />
                </div>

                {/* Preview thumbnail */}
                {previewUrl && (
                  <div className="rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
                    {resume.format === "pdf" ? (
                      <img
                        src={previewUrl}
                        alt={resume.fileName || "Resume preview"}
                        className="w-full h-32 object-cover object-top"
                      />
                    ) : (
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap line-clamp-6 p-2 font-sans">
                        {previewUrl}
                      </pre>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">ATS</span>
                    <span
                      className={cn(
                        "font-semibold",
                        fb.ATS.score >= 70
                          ? "text-success"
                          : fb.ATS.score >= 40
                            ? "text-warning"
                            : "text-danger",
                      )}
                    >
                      {fb.ATS.score}/100
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tone & Style</span>
                    <span
                      className={cn(
                        "font-semibold",
                        fb.toneAndStyle.score >= 70
                          ? "text-success"
                          : fb.toneAndStyle.score >= 40
                            ? "text-warning"
                            : "text-danger",
                      )}
                    >
                      {fb.toneAndStyle.score}/100
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Content</span>
                    <span
                      className={cn(
                        "font-semibold",
                        fb.content.score >= 70
                          ? "text-success"
                        : fb.content.score >= 40
                          ? "text-warning"
                        : "text-danger",
                      )}
                    >
                      {fb.content.score}/100
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Structure</span>
                    <span
                      className={cn(
                        "font-semibold",
                        fb.structure.score >= 70
                          ? "text-success"
                        : fb.structure.score >= 40
                          ? "text-warning"
                        : "text-danger",
                      )}
                    >
                      {fb.structure.score}/100
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Skills</span>
                    <span
                      className={cn(
                        "font-semibold",
                        fb.skills.score >= 70
                          ? "text-success"
                        : fb.skills.score >= 40
                          ? "text-warning"
                        : "text-danger",
                      )}
                    >
                      {fb.skills.score}/100
                    </span>
                  </div>
                </div>
                <Link
                  to={`/resumes/${resume.id}`}
                  className="mt-2 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors text-center"
                >
                  View Full Details →
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}