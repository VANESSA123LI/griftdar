/** Circular score gauge. Color shifts green -> amber -> red as score rises. */
export function ScoreGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  const color =
    clamped >= 67 ? "#f87171" : clamped >= 34 ? "#fbbf24" : "#34d399";
  const label =
    clamped >= 67 ? "High" : clamped >= 34 ? "Moderate" : "Low";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90">
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="14"
          className="text-neutral-800"
        />
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms ease-out" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-bold tabular-nums" style={{ color }}>
          {clamped}
          <span className="text-xl text-neutral-400">%</span>
        </span>
        <span className="text-xs uppercase tracking-wide text-neutral-400">
          {label} signal
        </span>
      </div>
    </div>
  );
}
