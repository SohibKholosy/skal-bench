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
| Shared calculation entrypoint (initial move) | calculations.js | calculations/index.js | all 14 tests | Complete — implementation moved intact; legacy file re-exports |
| Relative permeability | calculations.js | calculations/relativePermeability.js | JBN, Corey | Pending |
| Capillary pressure | calculations.js | calculations/capillaryPressure.js | centrifuge, MICP | Pending |
| Electrical | calculations.js | calculations/electrical.js | Waxman–Smits, formation factor | Pending |
| NMR | calculations.js | calculations/nmr.js | SDR, Timur–Coates | Pending |
| Correlations | calculations.js | calculations/correlations.js | stress, Winland, phi–k fits | Pending |

## Deferred scientific matters

The Phase 3 `REVIEW REQUIRED` items remain deferred. A possible scientific discrepancy discovered during this refactor will be documented, not corrected, in this branch.

## Completed increment: shared entrypoint

- Created `src/calculations/index.js` containing the prior `calculations.js` implementation unchanged.
- Changed `src/calculations.js` to a single re-export for temporary compatibility; it contains no scientific calculation implementation.
- Updated `App.jsx` and the regression suite to import `src/calculations/index.js` directly.
- Behavior-preservation check: 14/14 regression tests passed after this move.
- No scientific issues were discovered or addressed in this increment.

## Completed increment: shared math helpers and permeability

- Created `src/calculations/math.js` and moved the unchanged helper bodies for `areaFromDiameter`, `avg`, `stdev`, `linreg`, and `linregOrigin`.
- Created `src/calculations/permeability.js` and moved the unchanged implementations of `gasSteady`, `gasSingle`, `pulseDecay`, and `liquidCoreflood`.
- `src/calculations/index.js` now imports and exposes those four permeability functions through the existing `calculationFunctions` entrypoint.
- The remaining unextracted functions in `index.js` use `avg` and `linreg`; explicit imports from `math.js` preserve that dependency without duplicating helper logic.
- Behavior-preservation check: 14/14 regression tests passed after the extraction. No scientific or user-visible output changed.
- The production dependency direction is one-way: `index.js → math.js`, `index.js → permeability.js`, and `permeability.js → math.js`; no circular import was introduced.
- Current `src/calculations/index.js`: 365 lines. The remaining technical debt is the still-unextracted domain functions in that file; they will be moved only as separately tested increments.

## Completed increment: relative permeability

- Created `src/calculations/relativePermeability.js`.
- Moved the unchanged production logic for steady-state oil/water relative permeability, `relPermJBN`, and `coreyPredict`.
- The steady-state calculator was previously an inline `App.jsx` configuration closure. Its configuration now calls `calculationFunctions.relPermSteady`; JBN and Corey continue through the same entrypoint.
- Shared dependency: `relPermSteady` imports `areaFromDiameter` from `math.js`. The entrypoint supplies the pre-existing fixed-decimal formatter to steady-state and JBN so their displayed labels retain their prior values.
- Duplicate-logic review: the steady-state Darcy calculation occurs once in `relativePermeability.js`; obsolete JBN and Corey definitions were removed from `index.js`.
- Dependency review: `relativePermeability.js → math.js`; `index.js → relativePermeability.js`. Neither module imports the entrypoint, so no circular import or new domain coupling was introduced.
- Behavior-preservation check: 14/14 regression tests passed after extraction. No scientific calculation, calculated output, or user-visible behavior changed.
- Current `src/calculations/index.js`: 235 lines. Remaining technical debt is limited to the unextracted non-relative-permeability domains retained there for later, separately tested increments.

## Completed increment: capillary pressure / MICP / centrifuge

- Created `src/calculations/capillaryPressure.js`.
- Moved the complete `centrifugePc` reduction, including the Hassler–Brunner branch and the existing regularized direct-inversion, monotonicity projection, selection threshold, and all local numerical logic.
- Moved `micpWashburnDiameter`, retaining its existing pressure conversion, surface-tension conversion, contact-angle convention, and diameter result.
- No capillary helper moved separately: all numerical helpers used by centrifuge remain local to its function. The pre-existing `fmtForCentrifuge` helper remains in `index.js` because electrical, stress, rock-typing, and correlation functions also use it; the entrypoint passes it to centrifuge solely to retain the existing labels.
- Duplicate-logic review: one production definition each of `centrifugePc` and `micpWashburnDiameter`, both in `capillaryPressure.js`; no residual assignments remain in `index.js` or `App.jsx`.
- Dependency review: `index.js → capillaryPressure.js`; the capillary module has no imports and no access to UI state. No circular import or hidden UI dependency was introduced.
- Syntax review: no duplicate-comma patterns were found in the edited production files.
- Behavior-preservation check: 14/14 regression tests passed after extraction. No scientific calculation, calculated output, or user-visible behavior changed.
- Current `src/calculations/index.js`: 132 lines. Remaining technical debt is limited to the unextracted electrical, NMR, stress, rock-typing, and correlation domains retained there for later independently tested increments.

## Completed increment: wettability

- Created `src/calculations/wettability.js`.
- Moved the unchanged Amott/Amott–Harvey and USBM reducer as `amottUsbm`, retaining ratios, optional-area treatment, classification bands, labels, and output structure.
- Moved contact-angle numerical interpretation: the seven wettability bands, fluid setup mapping, geometric angle calculation, supplementary-angle conversion, surface classification, and line-intersection helper.
- The React screen retains its image state, point selection, event handlers, and canvas rendering. It now invokes `calculationFunctions.contactAngle(points, mode)` for the numerical result and obtains setup metadata through the shared entrypoint.
- Shared dependency: `amottUsbm` imports `avg` from `math.js`; the entrypoint supplies the existing fixed-decimal formatter for unchanged Amott/USBM result text. Contact-angle logic has no math or UI import.
- Duplicate-logic review: one production definition each of the Amott/USBM reducer, contact-angle reducer, angle helper, and line-intersection helper, all in `wettability.js`.
- Dependency review: `index.js → wettability.js → math.js`; no module imports `index.js`, and no circular import or UI-state dependency was introduced.
- Syntax review: no duplicate-comma patterns were found in the edited production files.
- Behavior-preservation check: 14/14 regression tests passed after extraction. No scientific calculation, calculated output, or user-visible behavior changed.
- Current `src/calculations/index.js`: 137 lines. Remaining technical debt is limited to unextracted electrical, NMR, stress, rock-typing, and correlation domains. The existing 14-test suite has no dedicated Amott/USBM or contact-angle regression case; adding coverage belongs to a future testing scope, not this behavior-preserving extraction.

## Completed increment: wettability regression coverage

- Added two deterministic regression tests in `test/calculations.test.js`, both importing `calculationFunctions` from the shared production entrypoint.
- Amott/USBM coverage verifies the synthetic Amott displacement ratios, Amott–Harvey index, USBM `log₁₀(A1/A2)` value, result selection, and the existing water-wet output label.
- Contact-angle coverage uses a 60° analytic tangent geometry and verifies the current water-drop and oil-drop phase mapping, including the supplementary water-angle result and existing classification/surface labels.
- No production calculation, scientific output, threshold, convention, default, or user-visible behavior changed. The Phase 3 contact-angle classification review status is unchanged.
- Behavior-preservation check: all prior 14 tests remain passing; total regression suite is now 16/16. No duplicate-comma patterns were found in the edited test or wettability files.
