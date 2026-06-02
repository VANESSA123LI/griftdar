import type { Signal } from "@/lib/types";

/** A single signal row: label, contribution bar, percentage, and explanation. */
export function SignalBar({ signal }: { signal: Signal }) {
  const pct = Math.round(Math.max(0, Math.min(1, signal.value)) * 100);
  const color = pct >= 67 ? "bg-red-400" : pct >= 34 ? "bg-amber-400" : "bg-emerald-400";

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-medium text-neutral-100">{signal.label}</h3>
        <span className="shrink-0 text-sm tabular-nums text-neutral-400">
          {pct}%
          <span className="ml-2 text-xs text-neutral-600">
            weight {signal.weight.toFixed(2)}
          </span>
        </span>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-800"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={signal.label}
      >
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%`, transition: "width 700ms ease-out" }}
        />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-neutral-400">
        {signal.explanation}
      </p>
    </div>
  );
}
