/* Flat semantic fills from the token set. No gradients: the score number
   carries the meaning, the ring only echoes it. */
function getScoreFill(score: number) {
  if (score >= 90) return "#1E5F8C";
  if (score >= 70) return "#16a34a";
  if (score >= 40) return "#d97706";
  return "#dc2626";
}

function ScoreCircle({ score = 75, size = 100 }: { score: number; size?: number }) {
  const radius = 40;
  const stroke = 8;
  const normalizedRadius = radius - stroke / 2;
  const circumference = 2 * Math.PI * normalizedRadius;
  const progress = score / 100;
  const strokeDashoffset = circumference * (1 - progress);
  const fill = getScoreFill(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        height="100%"
        width="100%"
        viewBox="0 0 100 100"
        className="transform -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="50"
          cy="50"
          r={normalizedRadius}
          stroke="#E8DDD1"
          strokeWidth={stroke}
          fill="transparent"
        />
        <circle
          cx="50"
          cy="50"
          r={normalizedRadius}
          stroke={fill}
          strokeWidth={stroke}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            transition: "stroke-dashoffset 600ms ease-out",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold text-gray-900" style={{ fontSize: size * 0.2 }} role="img" aria-label={`Score: ${score} out of 100`}>
          {score}
        </span>
        <span className="text-gray-500" style={{ fontSize: size * 0.1 }}>
          /100
        </span>
      </div>
    </div>
  );
}

export default ScoreCircle;
