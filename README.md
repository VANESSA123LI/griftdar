# griftdar 🛰️

**grifter radar** — paste a LinkedIn profile URL and get a 0–100 score for how
many "grifter" red-flag signals the profile shows, with a transparent,
per-signal breakdown.

> ⚠️ **Disclaimer:** The score is an automated heuristic for **informational
> purposes only**. It is **not** a factual claim or determination about any
> individual. griftdar does **not** build a public, searchable database of
> people — every analysis is on-demand and nothing about an analyzed person is
> persisted.

---

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** for styling
- A single API route (`/api/analyze`) for analysis
- **Vitest** for unit tests
- Deployable to **Vercel with no extra services** (no DB, no Redis)

## Quick start

```bash
npm install
cp .env.example .env.local   # defaults to the mock provider — no keys needed
npm run dev                  # http://localhost:3000
```

Open the app, paste a `linkedin.com/in/...` URL, and hit **Analyze**.

> In mock mode the result is chosen deterministically from the URL slug. Try a
> slug containing `guru`/`ninja` (grifter fixture) vs. `engineer`/`legit`
> (grounded fixture) to see the range.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm test` | Run unit tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |

## Mock vs. API: the data provider toggle

The scraping layer is hidden behind a `DataProvider` interface with two
implementations, selected by the `DATA_PROVIDER` env var:

| `DATA_PROVIDER` | Implementation | Needs a key? | Use for |
| --- | --- | --- | --- |
| `mock` (default) | `MockProvider` — hardcoded fixtures | No | Local dev, demos, tests |
| `api` | `ProxycurlProvider` — calls the Proxycurl LinkedIn data API | Yes (`PROXYCURL_API_KEY`) | Real profiles |

To use real data:

```bash
# .env.local
DATA_PROVIDER=api
PROXYCURL_API_KEY=your_key_here   # from https://nubela.co/proxycurl
```

We call a **third-party data API** for profile data; we do **not** run a
headless browser against linkedin.com. If `DATA_PROVIDER=api` but the key is
missing, the API route returns a clear, actionable error instead of crashing.

See [`.env.example`](./.env.example) for every supported variable.

## Where the Analyzer plugs in

The scoring layer is isolated behind an `Analyzer` interface so you can replace
the entire scoring architecture **without touching the API route, providers, or
frontend**.

```
src/lib/analyzer/
├── index.ts        # getAnalyzer() — the single swap seam
└── heuristic.ts    # HeuristicAnalyzer (the current placeholder)
```

- **To tweak the current heuristic:** edit the `SignalFn`s in
  `src/lib/analyzer/heuristic.ts` and the `SIGNALS` array. Each signal returns
  `{ label, value (0–1), weight, explanation }`; the final score is the
  weighted mean × 100, clamped to 0–100.
- **To swap in a new architecture** (ML model, LLM, external service, …):
  write a class implementing `Analyzer` (`analyze(profile) => AnalysisResult`)
  and return it from `getAnalyzer()` in `src/lib/analyzer/index.ts`. Done.

The current heuristic scores four transparent signals:

| Signal | Weight | What it looks at |
| --- | --- | --- |
| Buzzword density | 0.30 | promotional cliches per word of headline/about |
| Title vs. tenure | 0.25 | senior/founder titles held under a year |
| Vague / unverifiable claims | 0.25 | "as featured in", "DM me", hype phrasing |
| Follower-to-substance ratio | 0.20 | large audience vs. thin real substance |

## Project structure

```
src/
├── app/
│   ├── api/analyze/route.ts     # POST: rate-limit → validate → provider → analyzer
│   ├── components/
│   │   ├── ScoreGauge.tsx        # circular % score gauge
│   │   └── SignalBar.tsx         # per-signal breakdown row
│   ├── page.tsx                  # input, loading, results UI
│   ├── layout.tsx
│   └── globals.css
└── lib/
    ├── types.ts                  # ProfileData, Signal, AnalysisResult, interfaces
    ├── validation.ts             # strict linkedin.com/in/<slug> validation
    ├── rate-limit.ts             # in-memory sliding-window limiter
    ├── providers/
    │   ├── index.ts              # getProvider() — DATA_PROVIDER toggle
    │   ├── mock.ts               # MockProvider (default)
    │   └── proxycurl.ts          # ProxycurlProvider (DATA_PROVIDER=api)
    └── analyzer/
        ├── index.ts              # getAnalyzer() — the swap seam
        └── heuristic.ts          # HeuristicAnalyzer
```

## The API

`POST /api/analyze`

```jsonc
// request
{ "url": "https://www.linkedin.com/in/username" }

// 200 response
{
  "score": 72,
  "signals": [{ "label": "...", "value": 0.8, "weight": 0.3, "explanation": "..." }],
  "profile": { "url": "...", "name": "...", "headline": "..." },
  "disclaimer": "This score is an automated heuristic..."
}
```

Errors return `{ "error": "..." }` with an appropriate status: `400` (bad
URL/JSON), `429` (rate limited, with `Retry-After`), `404/502/503/504`
(provider issues), `405` (wrong method).

**Rate limiting:** 10 requests/minute per IP via an in-memory sliding window
(`src/lib/rate-limit.ts`). This is best-effort per serverless instance — enough
to blunt casual abuse with zero external dependencies. For a strict, distributed
limit, swap the implementation behind the same `rateLimit()` signature.

## Testing

```bash
npm test
```

Unit tests cover the `HeuristicAnalyzer`, LinkedIn URL validation, and the
`ProxycurlProvider` field/error mapping (with `fetch` mocked).

## Deploy to Vercel

1. Push to GitHub and import the repo in Vercel.
2. Set env vars in the Vercel dashboard (at minimum `DATA_PROVIDER`; add
   `PROXYCURL_API_KEY` if using `api` mode).
3. Deploy. No database or other services are required.

## Notes & limitations

- This is an **informational heuristic**, not a verdict. Treat it as a
  conversation starter, not evidence.
- Mock mode never makes network calls; API mode depends on Proxycurl's coverage
  and your credit balance.
- The in-memory rate limiter resets on cold starts and is per-instance.
