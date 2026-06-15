# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page FIRE (financial independence / retirement) calculator — **React 18 + TypeScript + Vite**, no backend. It models two phases entirely in **real (today's) dollars**: accumulation at a configurable real return, then retirement with a chosen stock/bond allocation. The UI, user-facing strings, and docs are in **Spanish (Rioplatense)** — keep new user-facing strings in Spanish. **Code comments are written in English.**

## Commands

```bash
npm install        # pnpm-lock.yaml is the committed lockfile; pnpm install also works
npm run dev        # Vite dev server on port 1818
npm run build      # tsc --noEmit (typecheck) THEN vite build → /dist
npm run preview    # serve the build on port 1818
```

There is **no test runner and no linter configured**. The only automated check is the TypeScript pass inside `build`; run `npx tsc --noEmit` to typecheck without bundling. `tsconfig.json` is `strict`. Tests over `finance.ts` are a known future idea (see README), not yet present.

## Architecture

The design principle throughout: **pure, typed model + derivation modules that are the single source of truth, consumed identically by the on-screen UI and the PDF export so the two can never drift.**

### The model — `src/finance.ts` (the heart; no React, no DOM — keep it pure)
- `computeLifecycle(inputs, assumptions)` runs the whole simulation: monthly-compounded accumulation until the FIRE number is hit, then annual-withdrawal retirement. Returns balances, trend (`grow`/`flat`/`decline`), depletion year, and the contributed-vs-compound-growth split. This is the file you edit to change the *model itself*.
- Works in **real terms**. `effectiveRealReturn` converts nominal→real via the Fisher equation when `assumptions.returnMode === "nominal"`.
- **Solve-for / auto-calc** (`SolveFor` = `timeline | monthly | initial`): inverse of accumulation. Because the balance after N years is *affine* in the solved variable, `solveMonthlyForYears` / `solveInitialForYears` recover the line from two evaluations of `accumulateBalance` and solve exactly — no search. **`accumulateBalance` must replicate `computeLifecycle`'s accumulation recurrence exactly; if you change one loop, mirror the other** or the solved value won't cross the simulation's `balance >= target` check (hence the `SOLVE_NUDGE` fudge).
- `applySolve` injects the solved value into a *copy* of the inputs before simulating, so chart, stats, verdict, and PDF all tell the same story. **It never mutates state** — the user's typed contribution/initial is preserved and restored when switching back to `timeline`.
- **Retirement "profiles" are derived, not stored.** `deriveProfile(withdrawalRate, allocation, isCustom)` maps the two underlying fields back to a profile label; selecting a profile just sets those two fields.

### Derivation modules shared by screen + PDF (also pure)
- `planSummary.ts` — `buildPlanSummary(...)` produces the retirement age, summary, and status verdict (`ok`/`bad`/`warn`). Takes a `surface: "screen" | "pdf"` param that intentionally varies wording in a few spots. Takes formatters as args (no DOM).
- `chartSeries.ts` — `buildChartSeries(result)` turns the model output into year-offset series; screen maps them to recharts rows (with `null` gaps), PDF maps them to `[x,y]` points.
- `palette.ts` — chart brand colors as flat `#rrggbb` (the PDF's `rgb()` parser needs that form), shared so recharts and the hand-drawn jsPDF chart stay in sync.

### UI — `src/RetirementPlanner.tsx`
The one big stateful component. Wires persisted state → `applySolve` → `computeLifecycle` → recharts + `buildPlanSummary`. `App.tsx` just composes the static page sections around it. Reusable controls live in `src/components/`.

### State, persistence, sharing
- `usePersistedState.ts` — `useState` mirrored to `localStorage`, with a **shallow merge against the initial value** on rehydrate so adding a new field never breaks a returning user's saved data.
- `exportData.ts` — the **validation/sanitization boundary**. `parsePlanData` never throws; every field is clamped/whitelisted against defaults, so an old, partial, or hand-edited file degrades gracefully. Bump `EXPORT_VERSION` when the data shape changes (current: v3).
- `shareUrl.ts` — encodes the whole plan into the URL hash (`#plan=...`, base64url) by **reusing `exportData`'s serializer + validator**. A bad link degrades to defaults exactly like a bad file.

### Conventions / gotchas
- **`currentAge === 0` means "no age loaded"** (`ageMode` is false), not literally age zero. The real default is `DEFAULT_AGE = 30`. Coast FIRE and the solve modes only apply when an age is set.
- Branding/config is centralized in `siteConfig.ts`; currencies in `format.ts` (`CURRENCIES` — add one there and the whole app picks it up).
- Build output is static with `base: "./"` (relative asset paths) so it works from `file://` or any subpath.
- No barrel/`index.ts` files — export from the implementation file and import from it directly.
