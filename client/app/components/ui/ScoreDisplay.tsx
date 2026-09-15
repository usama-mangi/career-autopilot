import { cn } from "~/lib/utils";

export interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg" | "xl";
  showLabel?: boolean;
  variant?: "default" | "compact" | "pill";
  className?: string;
}

const scoreThresholds = [
  { min: 70, label: "Strong", color: "green", bg: "bg-badge-green", text: "text-badge-green-text" },
  { min: 40, label: "Good start", color: "yellow", bg: "bg-badge-yellow", text: "text-badge-yellow-text" },
  { min: 0, label: "Needs work", color: "red", bg: "bg-badge-red", text: "text-badge-red-text" },
];

function getScoreConfig(score: number) {
  return scoreThresholds.find((t) => score >= t.min) || scoreThresholds[scoreThresholds.length - 1];
}

export function ScoreBadge({ score, size = "md", showLabel = true, variant = "default", className }: ScoreBadgeProps) {
  const config = getScoreConfig(score);

  const sizeStyles = {
    sm: "px-1.5 py-0.5 text-[10px] gap-0.5",
    md: "px-2 py-0.5 text-xs gap-1",
    lg: "px-3 py-1 text-sm gap-1.5",
    xl: "px-4 py-1.5 text-base gap-2",
  };

  const variantStyles = {
    default: "inline-flex items-center justify-center rounded-full font-semibold",
    compact: "inline-flex items-center justify-center rounded-full font-semibold",
    pill: "inline-flex items-center justify-center rounded-full font-medium",
  };

  const label = showLabel ? config.label : `${score}/100`;

  if (variant === "compact") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full font-semibold",
          sizeStyles[size],
          config.bg,
          config.text,
          className,
        )}
      >
        <span>{score}</span>
        {showLabel && <span className="opacity-70">·</span>}
        {showLabel && <span>{label}</span>}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center",
        sizeStyles[size],
        variantStyles[variant],
        config.bg,
        config.text,
        className,
      )}
    >
      <span>{score}</span>
      {showLabel && <span className="opacity-70">·</span>}
      {showLabel && <span>{label}</span>}
    </span>
  );
}

export interface ScoreCircleProps {
  score: number;
  size?: "sm" | "md" | "lg" | "xl";
  showLabel?: boolean;
  strokeWidth?: number;
  className?: string;
}

const circleSizes = {
  sm: 40,
  md: 48,
  lg: 64,
  xl: 80,
};

export function ScoreCircle({ score, size = "md", showLabel = true, strokeWidth, className }: ScoreCircleProps) {
  const config = getScoreConfig(score);
  const outer = circleSizes[size];

  return (
    <div className={cn("inline-flex flex-col items-center gap-1.5", className)}>
      <div
        className={cn(
          "relative flex items-center justify-center rounded-full border",
          config.color === "green" && "bg-emerald-50 border-emerald-200",
          config.color === "yellow" && "bg-amber-50 border-amber-200",
          config.color === "red" && "bg-red-50 border-red-200",
        )}
        style={{ width: outer, height: outer }}
      >
        <span
          className={cn(
            "font-bold tabular-nums leading-none",
            config.color === "green" && "text-emerald-700",
            config.color === "yellow" && "text-amber-700",
            config.color === "red" && "text-red-600",
          )}
        >
          {score}
        </span>
      </div>
      {showLabel && (
        <span
          className={cn(
            "text-[10px] font-medium leading-none",
            config.color === "green" && "text-emerald-600",
            config.color === "yellow" && "text-amber-600",
            config.color === "red" && "text-red-500",
          )}
        >
          {config.label}
        </span>
      )}
    </div>
  );
}

export interface ScoreBarProps {
  score: number;
  height?: number;
  showScore?: boolean;
  className?: string;
}

export function ScoreBar({ score, height = 6, showScore = true, className }: ScoreBarProps) {
  const config = getScoreConfig(score);

  // Flat semantic fills. A score is a number; the bar only echoes it.
  const fillStyles: Record<string, string> = {
    green: "bg-[#16a34a]",
    yellow: "bg-[#d97706]",
    red: "bg-[#dc2626]",
  };

  const color = config.color as keyof typeof fillStyles;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-1" aria-hidden="true">
        {showScore && (
          <span className={cn("text-xs font-semibold", config.color === "green" && "text-[#15803d]", config.color === "yellow" && "text-[#b45309]", config.color === "red" && "text-[#b91c1c]")}>
            {score}/100
          </span>
        )}
      </div>
      <div className="relative h-1.5 bg-gray-200 rounded-full overflow-hidden" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} aria-label={`Score: ${score} out of 100`}>
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            fillStyles[config.color],
          )}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export interface ScoreDisplayProps {
  score: number;
  variant?: "badge" | "circle" | "bar" | "compact";
  size?: "sm" | "md" | "lg" | "xl";
  showLabel?: boolean;
  className?: string;
}

export function ScoreDisplay({ score, variant = "badge", size = "md", showLabel = true, className }: ScoreDisplayProps) {
  const circleSize = size === "xl" ? "lg" : size;
  switch (variant) {
    case "circle":
      return <ScoreCircle score={score} size={circleSize} showLabel={showLabel} className={className} />;
    case "bar":
      return <ScoreBar score={score} showScore={showLabel} className={className} />;
    case "compact":
      return <ScoreBadge score={score} size={size} showLabel={showLabel} variant="compact" className={className} />;
    case "badge":
    default:
      return <ScoreBadge score={score} size={size} showLabel={showLabel} className={className} />;
  }
}

export default ScoreDisplay;