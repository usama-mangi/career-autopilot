import type { TipFeedback, Feedback } from "types";
import { cn } from "~/lib/utils";

type OnRateFn = (key: string, value: 'up' | 'down' | null) => void;

function getScoreBarClass(score: number) {
  if (score >= 70) return "score-bar-green";
  if (score >= 40) return "score-bar-yellow";
  return "score-bar-red";
}

function getScoreBg(score: number) {
  // Tint only the left edge of the card so the verdict reads at a glance
  // without bathing the whole panel in status color.
  if (score > 69) return "border-l-4 border-l-success";
  if (score > 49) return "border-l-4 border-l-warning";
  return "border-l-4 border-l-danger";
}

function getScoreIcon(score: number) {
  if (score > 69) return "/icons/ats-good.svg";
  if (score > 49) return "/icons/ats-warning.svg";
  return "/icons/ats-bad.svg";
}

const ATS = ({
  score,
  suggestions,
  tipFeedback,
  onRate
}: {
  score: number;
  suggestions: { type: "good" | "improve"; tip: string }[];
  tipFeedback: Record<string, 'up' | 'down' | null>;
  onRate: OnRateFn;
}) => {
  return (
    <div
      className={cn(
        "rounded-xl shadow-sm w-full bg-white p-6 flex flex-col gap-4 border border-[#E8DDD1]",
        getScoreBg(score),
      )}
    >
      <div className="flex flex-row gap-4 items-center">
        <img
          src={getScoreIcon(score)}
          alt=""
          className="w-10 h-10"
        />
        <div className="flex-1">
          <p className="text-lg font-bold text-gray-900">ATS Score</p>
          <p className="text-sm text-gray-500">How well does your resume pass through Applicant Tracking Systems?</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-gray-900">{score}</span>
          <span className="text-sm text-gray-400">/100</span>
        </div>
      </div>

      {/* Score bar */}
      <div className="score-bar">
        <div
          className={cn("score-bar-fill", getScoreBarClass(score))}
          style={{ width: `${score}%` }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-gray-500">
          Your resume was scanned like an employer would. Here's how it performed:
        </p>
        {suggestions.map((suggestion, index) => {
          const tipKey = `ats_${index}`;
          const current = tipFeedback[tipKey];
          return (
            <div
              key={index}
              className="flex flex-row gap-2 items-center justify-between group py-1"
            >
              <div className="flex flex-row gap-2 items-center flex-1">
                <img
                  src={
                    suggestion.type === "good"
                      ? "/icons/check.svg"
                      : "/icons/warning.svg"
                  }
                  alt=""
                  className="w-4 h-4 flex-shrink-0"
                />
                <p className="text-sm text-gray-600">{suggestion.tip}</p>
              </div>
              <div className="flex flex-row items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onRate(tipKey, current === 'up' ? null : 'up')}
                  title="Helpful"
                  aria-label="Helpful"
                  className={cn(
                    "flex items-center justify-center size-6 rounded-full border transition-colors cursor-pointer",
                    current === 'up'
                      ? "bg-success-light border-success text-success"
                      : "bg-white border-gray-200 text-gray-400 hover:text-gray-600",
                  )}
                >
                  <img src="/icons/thumb-up.svg" alt="" className="size-3" />
                </button>
                <button
                  onClick={() => onRate(tipKey, current === 'down' ? null : 'down')}
                  title="Not helpful"
                  aria-label="Not helpful"
                  className={cn(
                    "flex items-center justify-center size-6 rounded-full border transition-colors cursor-pointer",
                    current === 'down'
                      ? "bg-danger-light border-danger text-danger"
                      : "bg-white border-gray-200 text-gray-400 hover:text-gray-600",
                  )}
                >
                  <img src="/icons/thumb-down.svg" alt="" className="size-3" />
                </button>
              </div>
            </div>
          );
        })}
        <p className="text-sm text-gray-500">
          Want a better score? Improve your resume by applying the suggestions listed above.
        </p>
      </div>
    </div>
  );
};

export default ATS;
