# Phase 4 — Maintainability Refactor

## Scope and guardrails

Phase 4 is a behavior-preserving architecture refactor on `phase4/maintainability-refactor`, created from the Phase 3-merged `main` branch. No scientific formula, constant, unit conversion, default, algorithm, threshold, or calculated output is intentionally changed.

## Baseline

- `src/App.jsx`: 9,347 lines (718,507 characters).
- `src/calculations.js`: 472 lines.
- Regression suite: 14 tests.
- Existing shared calculation functions: gas/permeability baseline functions plus centrifuge, JBN, Waxman–Smits, MICP Washburn, NMR SDR/Timur–Coates, Corey, formation factor, stress dependence, Winland/FZI, and porosity–permeability regression helpers.
- Local build verification is environment-limited when Vite dependencies are unavailable; GitHub Actions remains the clean `npm ci` / `npm test` / `npm run build` verification environment.

## Original architecture

`App.jsx` contains application UI, React state, presentation helpers, calculator configuration, and some in-file scientific implementations. `calculations.js` was introduced in prior phases as a shared test/UI source for selected calculations.

## Target architecture

The existing shared calculation implementation will be moved into domain modules under `src/calculations/`. Both `App.jsx` and regression tests will import from the same `src/calculations/index.js` entrypoint. The legacy monolithic file will become a compatibility-free re-export only if it remains necessary during an incremental transition; it must not retain duplicate implementations.

## Incremental extraction register

| Group | Production source before | Planned target | Regression protection | Status |
|---|---|---|---|---|
| Shared math/helpers and baseline permeability | calculations.js | calculations/math.js, calculations/permeability.js | gas, Klinkenberg, pulse, liquid | Pending |
| Relative permeability | calculations.js | calculations/relativePermeability.js | JBN, Corey | Pending |
| Capillary pressure | calculations.js | calculations/capillaryPressure.js | centrifuge, MICP | Pending |
| Electrical | calculations.js | calculations/electrical.js | Waxman–Smits, formation factor | Pending |
| NMR | calculations.js | calculations/nmr.js | SDR, Timur–Coates | Pending |
| Correlations | calculations.js | calculations/correlations.js | stress, Winland, phi–k fits | Pending |

## Deferred scientific matters

The Phase 3 `REVIEW REQUIRED` items remain deferred. A possible scientific discrepancy discovered during this refactor will be documented, not corrected, in this branch.
