import { useEffect, useRef, useState } from "react";

/* Flat semantic fills from the token set. No gradients: the score number
   carries the meaning, the arc only echoes it. */
function getScoreColors(score: number) {
  if (score >= 90) return { fill: "#1E5F8C" };
  if (score >= 70) return { fill: "#16a34a" };
  if (score >= 40) return { fill: "#d97706" };
  return { fill: "#dc2626" };
}

export default function ScoreGauge({ score = 75 }: { score: number }) {
  const [pathLength, setPathLength] = useState(0);
  const [animated, setAnimated] = useState(false);
  const pathRef = useRef<SVGPathElement>(null);

  const percentage = score / 100;
  const colors = getScoreColors(score);

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
      requestAnimationFrame(() => setAnimated(true));
    }
  }, []);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-20">
        <svg viewBox="0 0 100 50" className="w-full h-full" aria-hidden="true">
          <path
            d="M10,50 A40,40 0 0,1 90,50"
            fill="none"
            stroke="#E8DDD1"
            strokeWidth="10"
            strokeLinecap="round"
          />

          <path
            ref={pathRef}
            d="M10,50 A40,40 0 0,1 90,50"
            fill="none"
            stroke={colors.fill}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={pathLength}
            strokeDashoffset={animated ? pathLength * (1 - percentage) : pathLength}
            style={{ transition: "stroke-dashoffset 600ms ease-out" }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
          <div className="text-xl font-bold text-gray-900 pt-4" role="img" aria-label={`Score: ${score} out of 100`}>
            {score}
          </div>
          <div className="text-xs text-gray-500">/100</div>
        </div>
      </div>
    </div>
  );
}
