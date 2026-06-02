"use client";

import { useState } from "react";
import { validateLinkedInUrl } from "@/lib/validation";
import type { AnalyzeResponse } from "@/app/api/analyze/route";
import { ScoreGauge } from "@/app/components/ScoreGauge";
import { SignalBar } from "@/app/components/SignalBar";

type Status = "idle" | "loading" | "done" | "error";

export default function Home() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side validation before hitting the network.
    const v = validateLinkedInUrl(url);
    if (!v.ok) {
      setStatus("error");
      setError(v.error ?? "Please enter a valid LinkedIn profile URL.");
      return;
    }

    setStatus("loading");
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: v.normalized }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `Request failed (${res.status}).`);
      }
      setResult(data as AnalyzeResponse);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    }
  }

  const loading = status === "loading";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-5 py-12 sm:py-20">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          grift<span className="text-emerald-400">dar</span>
        </h1>
        <p className="mt-3 text-neutral-400">
          Paste a LinkedIn profile URL to see how many{" "}
          <span className="text-neutral-200">grifter red-flag signals</span> it
          shows.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label htmlFor="url" className="sr-only">
          LinkedIn profile URL
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="url"
            type="text"
            inputMode="url"
            autoComplete="off"
            placeholder="https://www.linkedin.com/in/username"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-emerald-500 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || url.trim().length === 0}
            className="rounded-lg bg-emerald-500 px-6 py-3 font-medium text-neutral-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
        {status === "error" && error && (
          <p
            role="alert"
            className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300"
          >
            {error}
          </p>
        )}
      </form>

      {loading && <LoadingState />}

      {status === "done" && result && <Results result={result} />}

      {status === "idle" && (
        <p className="text-center text-sm text-neutral-600">
          Tip: try a URL containing “guru” or “engineer” to see different mock
          results.
        </p>
      )}
    </main>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center gap-4 py-8" aria-live="polite">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-700 border-t-emerald-400" />
      <p className="text-sm text-neutral-400">Fetching profile and scoring signals…</p>
    </div>
  );
}

function Results({ result }: { result: AnalyzeResponse }) {
  return (
    <section className="flex flex-col gap-6" aria-live="polite">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-6 text-center">
        <ScoreGauge score={result.score} />
        <div>
          <p className="text-lg font-medium text-neutral-100">
            {result.profile.name ?? "This profile"}
          </p>
          {result.profile.headline && (
            <p className="mt-1 max-w-md text-sm text-neutral-500">
              {result.profile.headline}
            </p>
          )}
          <a
            href={result.profile.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-2 inline-block text-xs text-emerald-500/80 underline-offset-2 hover:underline"
          >
            {result.profile.url}
          </a>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Signal breakdown
        </h2>
        {result.signals.map((s) => (
          <SignalBar key={s.label} signal={s} />
        ))}
      </div>

      <p className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-xs leading-relaxed text-neutral-500">
        <span className="font-semibold text-neutral-400">Disclaimer: </span>
        {result.disclaimer}
      </p>
    </section>
  );
}
